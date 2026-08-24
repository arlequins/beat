import { createHash, randomUUID } from "node:crypto";

import { serverEnv } from "@arlequins/env/server-env";
import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const IMAGE_TYPES = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
} as const;
const MAX_IMAGE_BYTES = 768 * 1024;

import { GourmetError } from "../application/errors";
import type {
  GourmetEntry,
  GourmetHistoryItem,
  GourmetImage,
  GourmetInput,
  GourmetListFilter,
  GourmetStatus,
} from "../domain/models";

type Stored<T> = { etag: string; value: T };
type GourmetConfig = {
  ledgerBucket: string;
  ledgerRetentionDays?: number;
  stateBucket: string;
  statePrefix: string;
};

function required(value: string | undefined, name: string) {
  if (!value)
    throw new GourmetError("storage_unavailable", `${name} is required`);
  return value;
}

function config(): GourmetConfig {
  return {
    ledgerBucket: required(
      serverEnv.BEAT_AUTH_LEDGER_BUCKET,
      "BEAT_AUTH_LEDGER_BUCKET",
    ),
    ledgerRetentionDays: serverEnv.BEAT_AUTH_LEDGER_RETENTION_DAYS,
    stateBucket: required(
      serverEnv.BEAT_AUTH_STATE_BUCKET,
      "BEAT_AUTH_STATE_BUCKET",
    ),
    statePrefix: serverEnv.BEAT_AUTH_STATE_PREFIX.replace(/^\/|\/$/g, ""),
  };
}

function entryKey(id: string, value: GourmetConfig) {
  return `${value.statePrefix}/gourmet/entries/${id}/head.json`;
}

function entriesPrefix(value: GourmetConfig) {
  return `${value.statePrefix}/gourmet/entries/`;
}

function revisionKey(id: string, revision: number, value: GourmetConfig) {
  return `${value.statePrefix}/gourmet/entries/${id}/revisions/${revision}.json`;
}

function revisionsPrefix(id: string, value: GourmetConfig) {
  return `${value.statePrefix}/gourmet/entries/${id}/revisions/`;
}

function imageKey(entryId: string, imageId: string, value: GourmetConfig) {
  return `${value.statePrefix}/gourmet/images/${entryId}/${imageId}`;
}

function bodyToString(body: unknown) {
  if (!body || typeof body !== "object" || !("transformToString" in body))
    throw new GourmetError("storage_unavailable", "Invalid S3 object body");
  return (
    body as { transformToString: () => Promise<string> }
  ).transformToString();
}

function isMissing(error: unknown) {
  const candidate = error as {
    $metadata?: { httpStatusCode?: number };
    name?: string;
  };
  return (
    candidate?.$metadata?.httpStatusCode === 404 ||
    candidate?.name === "NoSuchKey"
  );
}

function isConflict(error: unknown) {
  const candidate = error as {
    $metadata?: { httpStatusCode?: number };
    name?: string;
  };
  return (
    candidate?.$metadata?.httpStatusCode === 412 ||
    candidate?.name === "PreconditionFailed"
  );
}

async function getJson<T>(client: S3Client, bucket: string, key: string) {
  try {
    const response = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    if (!response.ETag)
      throw new GourmetError(
        "storage_unavailable",
        "S3 object is missing an ETag",
      );
    return {
      etag: response.ETag,
      value: JSON.parse(await bodyToString(response.Body)) as T,
    } satisfies Stored<T>;
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
}

async function putJson(
  client: S3Client,
  input: {
    bucket: string;
    ifMatch?: string;
    ifNoneMatch?: "*";
    key: string;
    lockUntil?: Date;
    value: unknown;
  },
) {
  await client.send(
    new PutObjectCommand({
      Body: JSON.stringify(input.value),
      Bucket: input.bucket,
      ContentType: "application/json",
      IfMatch: input.ifMatch,
      IfNoneMatch: input.ifNoneMatch,
      Key: input.key,
      ...(input.lockUntil
        ? {
            ObjectLockMode: "COMPLIANCE" as const,
            ObjectLockRetainUntilDate: input.lockUntil,
          }
        : {}),
    }),
  );
}

function isEntry(value: unknown): value is GourmetEntry {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    row.schemaVersion === 1 &&
    typeof row.id === "string" &&
    typeof row.slug === "string" &&
    typeof row.revision === "number" &&
    typeof row.restaurantName === "string" &&
    typeof row.menuName === "string" &&
    typeof row.rating === "number" &&
    Array.isArray(row.images)
  );
}

function slugFor(input: GourmetInput, id: string) {
  const stem = `${input.restaurantName}-${input.menuName}`
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 48);
  return `${stem || "gourmet"}-${id.slice(0, 8)}`;
}

function idForKey(key?: string) {
  if (!key) return randomUUID();
  const hex = createHash("sha256").update(`gourmet:${key}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function fingerprint(input: GourmetInput) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function recordDigest(entry: GourmetEntry) {
  return createHash("sha256").update(JSON.stringify(entry)).digest("hex");
}

async function appendEvent(
  client: S3Client,
  value: GourmetConfig,
  type: string,
  details: Record<string, unknown>,
) {
  const now = new Date();
  const lockUntil = value.ledgerRetentionDays
    ? new Date(now.getTime() + value.ledgerRetentionDays * 86_400_000)
    : undefined;
  await putJson(client, {
    bucket: value.ledgerBucket,
    ifNoneMatch: "*",
    key: `v1/events/gourmet/${now.toISOString().slice(0, 10).replaceAll("-", "/")}/${now.toISOString()}-${randomUUID()}.json`,
    lockUntil,
    value: {
      details,
      eventId: randomUUID(),
      occurredAt: now.toISOString(),
      schemaVersion: 1,
      type,
    },
  });
}

async function listEntries(client: S3Client, value: GourmetConfig) {
  const keys: string[] = [];
  let continuationToken: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: value.stateBucket,
        ContinuationToken: continuationToken,
        Prefix: entriesPrefix(value),
      }),
    );
    for (const object of page.Contents ?? []) {
      if (object.Key?.endsWith("/head.json")) keys.push(object.Key);
    }
    continuationToken = page.IsTruncated
      ? page.NextContinuationToken
      : undefined;
  } while (continuationToken);
  const rows = await Promise.all(
    keys.map((key) => getJson<GourmetEntry>(client, value.stateBucket, key)),
  );
  return rows.filter((row): row is Stored<GourmetEntry> =>
    Boolean(row && isEntry(row.value)),
  );
}

function matches(entry: GourmetEntry, filter: GourmetListFilter) {
  const visited = entry.visitedAt ?? entry.createdAt.slice(0, 10);
  if (filter.status && entry.status !== filter.status) return false;
  if (filter.from && visited < filter.from) return false;
  if (filter.to && visited > filter.to) return false;
  if (
    filter.area &&
    entry.area?.toLocaleLowerCase() !== filter.area.toLocaleLowerCase()
  )
    return false;
  if (
    filter.restaurantName &&
    !entry.restaurantName
      .toLocaleLowerCase()
      .includes(filter.restaurantName.toLocaleLowerCase())
  )
    return false;
  if (
    filter.cuisineTag &&
    !entry.cuisineTags.some(
      (tag) =>
        tag.toLocaleLowerCase() === filter.cuisineTag?.toLocaleLowerCase(),
    )
  )
    return false;
  if (
    filter.ingredient &&
    !entry.ingredients.some(
      (tag) =>
        tag.toLocaleLowerCase() === filter.ingredient?.toLocaleLowerCase(),
    )
  )
    return false;
  if (filter.revisit && entry.revisit !== filter.revisit) return false;
  return !(filter.minRating !== undefined && entry.rating < filter.minRating);
}

function summary(entry: GourmetEntry) {
  const { idempotencyFingerprint: _, ...result } = entry;
  return result;
}

export async function createGourmetEntry(
  input: GourmetInput,
  options: { idempotencyKey?: string; status?: GourmetStatus; subject: string },
  client = new S3Client({}),
) {
  const value = config();
  const requestFingerprint = fingerprint(input);
  const id = idForKey(options.idempotencyKey);
  const existing = await getJson<GourmetEntry>(
    client,
    value.stateBucket,
    entryKey(id, value),
  );
  if (existing) {
    if (existing.value.idempotencyFingerprint === requestFingerprint)
      return summary(existing.value);
    if (options.idempotencyKey)
      throw new GourmetError(
        "conflict",
        "Idempotency key was already used with another request",
      );
  }
  const now = new Date().toISOString();
  const entry: GourmetEntry = {
    ...input,
    id,
    idempotencyFingerprint: options.idempotencyKey
      ? requestFingerprint
      : undefined,
    images: [],
    revision: 1,
    schemaVersion: 1,
    slug: slugFor(input, id),
    status: options.status ?? input.status,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await putJson(client, {
      bucket: value.stateBucket,
      ifNoneMatch: "*",
      key: entryKey(id, value),
      value: entry,
    });
    await putJson(client, {
      bucket: value.stateBucket,
      ifNoneMatch: "*",
      key: revisionKey(id, 1, value),
      value: entry,
    });
  } catch (error) {
    if (isConflict(error)) {
      const winner = await getJson<GourmetEntry>(
        client,
        value.stateBucket,
        entryKey(id, value),
      );
      if (winner?.value.idempotencyFingerprint === requestFingerprint)
        return summary(winner.value);
      throw new GourmetError(
        "conflict",
        "A conflicting gourmet record already exists",
      );
    }
    throw error;
  }
  await appendEvent(client, value, "gourmet-created", {
    digest: recordDigest(entry),
    id,
    source: entry.source,
    subject: options.subject,
  });
  return summary(entry);
}

export async function getGourmetEntry(
  idOrSlug: string,
  client = new S3Client({}),
) {
  const value = config();
  const direct = await getJson<GourmetEntry>(
    client,
    value.stateBucket,
    entryKey(idOrSlug, value),
  );
  if (direct && isEntry(direct.value))
    return { entry: direct.value, etag: direct.etag };
  const rows = await listEntries(client, value);
  const found = rows.find((row) => row.value.slug === idOrSlug);
  return found ? { entry: found.value, etag: found.etag } : undefined;
}

export async function listGourmetEntries(
  filter: GourmetListFilter,
  client = new S3Client({}),
) {
  const value = config();
  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 20;
  const rows = (await listEntries(client, value))
    .map((row) => row.value)
    .filter((entry) => matches(entry, filter))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const start = (page - 1) * pageSize;
  return {
    entries: rows.slice(start, start + pageSize).map(summary),
    nextPage: start + pageSize < rows.length ? page + 1 : undefined,
    page,
    total: rows.length,
  };
}

export async function gourmetHistory(
  id: string,
  client = new S3Client({}),
): Promise<GourmetHistoryItem[]> {
  const value = config();
  const objects = await client.send(
    new ListObjectsV2Command({
      Bucket: value.stateBucket,
      Prefix: revisionsPrefix(id, value),
    }),
  );
  const rows = await Promise.all(
    (objects.Contents ?? [])
      .map((object) => object.Key)
      .filter((key): key is string => Boolean(key))
      .map((key) => getJson<GourmetEntry>(client, value.stateBucket, key)),
  );
  return rows
    .map((row) => row?.value)
    .filter((entry): entry is GourmetEntry => Boolean(entry && isEntry(entry)))
    .map(
      ({
        menuName,
        restaurantName,
        revision,
        status,
        updatedAt,
        visitedAt,
      }) => ({
        menuName,
        restaurantName,
        revision,
        status,
        updatedAt,
        visitedAt,
      }),
    )
    .sort((left, right) => right.revision - left.revision);
}

export async function updateGourmetEntry(
  id: string,
  patch: Partial<GourmetInput> & {
    deletedAt?: string;
    expectedRevision?: number;
    images?: GourmetImage[];
  },
  subject: string,
  client = new S3Client({}),
) {
  const value = config();
  const stored = await getGourmetEntry(id, client);
  if (!stored || stored.entry.status === "deleted")
    throw new GourmetError("not_found", "Gourmet entry was not found");
  if (
    patch.expectedRevision !== undefined &&
    patch.expectedRevision !== stored.entry.revision
  )
    throw new GourmetError("conflict", "Gourmet entry revision is stale");
  const { expectedRevision: _, ...changes } = patch;
  const next: GourmetEntry = {
    ...stored.entry,
    ...changes,
    revision: stored.entry.revision + 1,
    updatedAt: new Date().toISOString(),
  };
  try {
    await putJson(client, {
      bucket: value.stateBucket,
      ifMatch: stored.etag,
      key: entryKey(next.id, value),
      value: next,
    });
    await putJson(client, {
      bucket: value.stateBucket,
      ifNoneMatch: "*",
      key: revisionKey(next.id, next.revision, value),
      value: next,
    });
  } catch (error) {
    if (isConflict(error))
      throw new GourmetError("conflict", "Gourmet entry changed concurrently");
    throw error;
  }
  await appendEvent(client, value, "gourmet-updated", {
    digest: recordDigest(next),
    id: next.id,
    revision: next.revision,
    subject,
  });
  return summary(next);
}

export async function deleteGourmetEntry(
  id: string,
  subject: string,
  client = new S3Client({}),
) {
  const stored = await getGourmetEntry(id, client);
  if (!stored || stored.entry.status === "deleted")
    throw new GourmetError("not_found", "Gourmet entry was not found");
  return updateGourmetEntry(
    id,
    {
      deletedAt: new Date().toISOString(),
      expectedRevision: stored.entry.revision,
      status: "deleted",
    },
    subject,
    client,
  );
}

export async function restoreGourmetEntry(
  id: string,
  subject: string,
  client = new S3Client({}),
) {
  const value = config();
  const stored = await getGourmetEntry(id, client);
  if (stored?.entry.status !== "deleted")
    throw new GourmetError("not_found", "Gourmet entry was not archived");
  const { deletedAt: _, ...withoutDeletedAt } = stored.entry;
  const next: GourmetEntry = {
    ...withoutDeletedAt,
    revision: stored.entry.revision + 1,
    status: "draft",
    updatedAt: new Date().toISOString(),
  };
  await putJson(client, {
    bucket: value.stateBucket,
    ifMatch: stored.etag,
    key: entryKey(next.id, value),
    value: next,
  });
  await putJson(client, {
    bucket: value.stateBucket,
    ifNoneMatch: "*",
    key: revisionKey(next.id, next.revision, value),
    value: next,
  });
  await appendEvent(client, value, "gourmet-restored", {
    digest: recordDigest(next),
    id,
    revision: next.revision,
    subject,
  });
  return summary(next);
}

function extensionFor(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function magicMime(bytes: Uint8Array): keyof typeof IMAGE_TYPES | undefined {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (
    bytes
      .slice(0, 8)
      .every(
        (value, index) =>
          value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index],
      )
  )
    return "image/png";
  if (
    new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  return undefined;
}

export async function attachGourmetImage(
  entryId: string,
  input: {
    altText: string;
    contentBase64: string;
    contentType: keyof typeof IMAGE_TYPES;
    originalFilename: string;
  },
  subject: string,
  client = new S3Client({}),
) {
  const stored = await getGourmetEntry(entryId, client);
  if (!stored || stored.entry.status === "deleted")
    throw new GourmetError("not_found", "Gourmet entry was not found");
  let content: Buffer;
  try {
    content = Buffer.from(input.contentBase64, "base64");
  } catch {
    throw new GourmetError(
      "image_invalid",
      "Image content is not valid base64",
    );
  }
  const actualMime = magicMime(content.subarray(0, 16));
  if (
    !content.length ||
    content.length > MAX_IMAGE_BYTES ||
    actualMime !== input.contentType ||
    !IMAGE_TYPES[input.contentType].includes(
      extensionFor(input.originalFilename) as never,
    )
  )
    throw new GourmetError(
      "image_invalid",
      "Only verified JPEG, PNG, and WebP images up to 768 KiB are accepted",
    );
  const digest = createHash("sha256")
    .update(entryId)
    .update(content)
    .digest("hex");
  const imageId = digest.slice(0, 16);
  const existing = stored.entry.images.find((image) => image.id === imageId);
  if (existing) return summary(stored.entry);
  const value = config();
  const storageKey = imageKey(stored.entry.id, imageId, value);
  try {
    await client.send(
      new PutObjectCommand({
        Body: content,
        Bucket: value.stateBucket,
        CacheControl: "public, max-age=31536000, immutable",
        ContentType: input.contentType,
        IfNoneMatch: "*",
        Key: storageKey,
        Metadata: {
          "original-filename": encodeURIComponent(input.originalFilename),
        },
      }),
    );
  } catch (error) {
    // The content-hash key makes an existing object safe to reuse after a
    // previous request lost a state-head race.
    if (!isConflict(error)) throw error;
  }
  const image: GourmetImage = {
    altText: input.altText,
    byteSize: content.length,
    createdAt: new Date().toISOString(),
    height: null,
    id: imageId,
    mimeType: input.contentType,
    originalFilename: input.originalFilename,
    publicPath: `/api/gourmet/images/${stored.entry.id}/${imageId}`,
    sortOrder: stored.entry.images.length,
    storageKey,
    width: null,
  };
  return updateGourmetEntry(
    entryId,
    {
      expectedRevision: stored.entry.revision,
      images: [...stored.entry.images, image],
    },
    subject,
    client,
  );
}

export async function removeGourmetImage(
  entryId: string,
  imageId: string,
  subject: string,
  client = new S3Client({}),
) {
  const stored = await getGourmetEntry(entryId, client);
  if (!stored || stored.entry.status === "deleted")
    throw new GourmetError("not_found", "Gourmet entry was not found");
  if (!stored.entry.images.some((image) => image.id === imageId))
    throw new GourmetError("image_not_found", "Gourmet image was not found");
  return updateGourmetEntry(
    entryId,
    {
      expectedRevision: stored.entry.revision,
      images: stored.entry.images.filter((image) => image.id !== imageId),
    },
    subject,
    client,
  );
}

export async function updateGourmetImage(
  entryId: string,
  imageId: string,
  input: { altText?: string; expectedRevision?: number; sortOrder?: number },
  subject: string,
  client = new S3Client({}),
) {
  const stored = await getGourmetEntry(entryId, client);
  if (!stored || stored.entry.status === "deleted")
    throw new GourmetError("not_found", "Gourmet entry was not found");
  if (!stored.entry.images.some((image) => image.id === imageId))
    throw new GourmetError("image_not_found", "Gourmet image was not found");
  const ordered = [...stored.entry.images].sort(
    (left, right) => left.sortOrder - right.sortOrder,
  );
  const currentIndex = ordered.findIndex((image) => image.id === imageId);
  const targetIndex = Math.min(
    ordered.length - 1,
    Math.max(0, input.sortOrder ?? currentIndex),
  );
  const [current] = ordered.splice(currentIndex, 1);
  if (!current)
    throw new GourmetError("image_not_found", "Gourmet image was not found");
  ordered.splice(targetIndex, 0, {
    ...current,
    ...(input.altText?.trim() ? { altText: input.altText.trim() } : {}),
  });
  return updateGourmetEntry(
    entryId,
    {
      expectedRevision: input.expectedRevision ?? stored.entry.revision,
      images: ordered.map((image, sortOrder) => ({ ...image, sortOrder })),
    },
    subject,
    client,
  );
}

async function readGourmetImage(
  entryId: string,
  imageId: string,
  client = new S3Client({}),
  requirePublished = true,
) {
  const value = config();
  const stored = await getGourmetEntry(entryId, client);
  if (
    !stored ||
    stored.entry.status === "deleted" ||
    (requirePublished && stored.entry.status !== "published")
  )
    throw new GourmetError("image_not_found", "Gourmet image was not found");
  const image = stored.entry.images.find(
    (candidate) => candidate.id === imageId,
  );
  if (!image || image.storageKey !== imageKey(entryId, imageId, value))
    throw new GourmetError("image_not_found", "Gourmet image was not found");
  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: value.stateBucket,
        Key: image.storageKey,
      }),
    );
    if (!response.Body)
      throw new GourmetError(
        "storage_unavailable",
        "Gourmet image body is missing",
      );
    return {
      body: await response.Body.transformToByteArray(),
      contentLength: response.ContentLength,
      contentType: image.mimeType,
      etag: response.ETag,
      lastModified: response.LastModified,
    };
  } catch (error) {
    if (error instanceof GourmetError) throw error;
    if (isMissing(error))
      throw new GourmetError("image_not_found", "Gourmet image was not found");
    throw error;
  }
}

export function getGourmetImage(
  entryId: string,
  imageId: string,
  client = new S3Client({}),
) {
  return readGourmetImage(entryId, imageId, client, true);
}

export function getGourmetImageForAdmin(
  entryId: string,
  imageId: string,
  client = new S3Client({}),
) {
  return readGourmetImage(entryId, imageId, client, false);
}

export async function gourmetContext(
  input: { days: number; limit: number },
  client = new S3Client({}),
) {
  const from = new Date(Date.now() - input.days * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const records = (
    await listGourmetEntries(
      { from, pageSize: 500, status: "published" },
      client,
    )
  ).entries;
  const count = (values: string[]) => {
    const counts: Record<string, number> = {};
    for (const item of values) counts[item] = (counts[item] ?? 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  };
  const recentSeven = records.filter(
    (entry) =>
      (entry.visitedAt ?? entry.createdAt.slice(0, 10)) >=
      new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10),
  );
  return {
    averageRating: records.length
      ? Math.round(
          (records.reduce((sum, entry) => sum + entry.rating, 0) /
            records.length) *
            10,
        ) / 10
      : null,
    frequentlyUsedTasteNotes: count(
      records.flatMap((entry) => entry.tasteNotes),
    ).slice(0, 10),
    lowRatedEntries: records
      .filter((entry) => entry.rating <= 4)
      .slice(0, input.limit),
    nutritionTagsLast7Days: count(
      recentSeven.flatMap((entry) => entry.nutritionTags),
    ),
    recentAreas: count(
      records
        .map((entry) => entry.area)
        .filter((area): area is string => Boolean(area)),
    ).slice(0, 10),
    recentCuisineTags: count(
      records.flatMap((entry) => entry.cuisineTags),
    ).slice(0, 10),
    recentEntries: records.slice(0, input.limit),
    recentIngredients: count(
      records.flatMap((entry) => entry.ingredients),
    ).slice(0, 10),
    recentCookingMethods: count(
      records.flatMap((entry) => entry.cookingMethods),
    ).slice(0, 10),
    revisitCandidates: records
      .filter((entry) => entry.revisit === "yes" && entry.rating >= 7)
      .slice(0, input.limit),
  };
}
