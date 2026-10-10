import { serverEnv } from "@arlequins/env/server-env";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const OBJECT_KEY = "author-vault/reality-error/outline.md";
const ANNOTATIONS_OBJECT_KEY = "author-vault/reality-error/annotations.json";
const CATALOG_KEY = "author-vault/catalog.json";
export const MAX_PRIVATE_FICTION_SOURCE_BYTES = 4_000_000;
export const MAX_PRIVATE_FICTION_ANNOTATION_BYTES = 2_000_000;

export type PrivateFictionAnnotation = {
  id: string;
  episode: number;
  blockIndex: number;
  startOffset: number;
  endOffset: number;
  quote: string;
  prefix: string;
  suffix: string;
  comment: string;
  createdAt: string;
};

export type PrivateFictionAnnotationsDocument = {
  etag: string;
  annotations: PrivateFictionAnnotation[];
  updatedAt: string;
};

export type PrivateFictionDocument = {
  etag: string;
  source: string;
  updatedAt: string;
};

export type PrivateFictionEdition = { id: string; label: string };
export type PrivateFictionWork = {
  id: string;
  title: string;
  activeEditionId: string;
  editions: PrivateFictionEdition[];
  allowedSubjects: string[];
  createdAt: string;
  updatedAt: string;
};
export type PrivateFictionCatalog = {
  etag: string | null;
  works: PrivateFictionWork[];
};

export function isPrivateFictionId(value: string) {
  return /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(value);
}

function workObjectKey(workId: string, editionId: string) {
  if (!isPrivateFictionId(workId) || !isPrivateFictionId(editionId))
    throw new PrivateFictionStorageError("storage_unavailable");
  return `author-vault/works/${workId}/editions/${editionId}/outline.md`;
}

function annotationsObjectKey(workId: string, editionId: string) {
  return workObjectKey(workId, editionId).replace(
    /outline\.md$/,
    "annotations.json",
  );
}

async function getJsonObject<T>(key: string, client: S3Client) {
  try {
    const response = await client.send(
      new GetObjectCommand({ Bucket: bucketName(), Key: key }),
    );
    if (!response.ETag)
      throw new PrivateFictionStorageError("storage_unavailable");
    return {
      etag: response.ETag,
      value: JSON.parse(await bodyText(response.Body)) as T,
    };
  } catch (error) {
    if (error instanceof PrivateFictionStorageError) throw error;
    if (isMissing(error)) return undefined;
    if (isAccessDenied(error)) throw error;
    throw new PrivateFictionStorageError("storage_unavailable");
  }
}

export async function getPrivateFictionCatalog(client = new S3Client({})) {
  let stored:
    | { etag: string; value: { works?: PrivateFictionWork[] } }
    | undefined;
  try {
    stored = await getJsonObject<{ works?: PrivateFictionWork[] }>(
      CATALOG_KEY,
      client,
    );
  } catch (error) {
    if (!isAccessDenied(error)) throw error;
    // Missing S3 keys return 403 without ListBucket. Conditional creation below
    // distinguishes absence from an unreadable existing catalog safely.
  }
  if (stored) {
    if (
      !Array.isArray(stored.value.works) ||
      stored.value.works.some(
        (work) =>
          !isPrivateFictionId(work.id) ||
          typeof work.title !== "string" ||
          !Array.isArray(work.allowedSubjects) ||
          work.allowedSubjects.some((subject) => typeof subject !== "string") ||
          !Array.isArray(work.editions) ||
          !work.editions.some(
            (edition) => edition.id === work.activeEditionId,
          ) ||
          work.editions.some(
            (edition) =>
              !isPrivateFictionId(edition.id) ||
              typeof edition.label !== "string",
          ),
      )
    )
      throw new PrivateFictionStorageError("storage_unavailable");
    return { etag: stored.etag, works: stored.value.works };
  }
  // The old single-work object remains the source for existing readers until
  // the owner explicitly migrates it into the multi-work catalog.
  const legacy = await getPrivateFictionDocument(client);
  const initial = {
    etag: null,
    works: legacy
      ? [
          {
            id: "reality-error",
            title: "현실 오류",
            activeEditionId: "current",
            editions: [{ id: "current", label: "현재 판본" }],
            allowedSubjects: [],
            createdAt: legacy.updatedAt,
            updatedAt: legacy.updatedAt,
          },
        ]
      : [],
  } satisfies PrivateFictionCatalog;
  try {
    const etag = await savePrivateFictionCatalog(
      { expectedEtag: null, works: initial.works },
      client,
    );
    return { ...initial, etag };
  } catch (error) {
    if (
      !(error instanceof PrivateFictionStorageError) ||
      error.code !== "conflict"
    )
      throw error;
    // Read the winner once; never replace an existing catalog after a denial.
    const winner = await getJsonObject<{ works: PrivateFictionWork[] }>(
      CATALOG_KEY,
      client,
    );
    if (!winner || !Array.isArray(winner.value.works))
      throw new PrivateFictionStorageError("storage_unavailable");
    return { etag: winner.etag, works: winner.value.works };
  }
}

export async function savePrivateFictionCatalog(
  input: {
    expectedEtag: string | null;
    works: PrivateFictionWork[];
  },
  client = new S3Client({}),
) {
  try {
    const response = await client.send(
      new PutObjectCommand({
        Body: JSON.stringify({ works: input.works }),
        Bucket: bucketName(),
        CacheControl: "private, no-store, max-age=0",
        ContentType: "application/json; charset=utf-8",
        IfMatch: input.expectedEtag ?? undefined,
        IfNoneMatch: input.expectedEtag === null ? "*" : undefined,
        Key: CATALOG_KEY,
      }),
    );
    if (!response.ETag)
      throw new PrivateFictionStorageError("storage_unavailable");
    return response.ETag;
  } catch (error) {
    if (error instanceof PrivateFictionStorageError) throw error;
    if (isConflict(error)) throw new PrivateFictionStorageError("conflict");
    throw new PrivateFictionStorageError("storage_unavailable");
  }
}

export async function getPrivateFictionEdition(
  workId: string,
  editionId: string,
  client = new S3Client({}),
): Promise<PrivateFictionDocument | undefined> {
  if (workId === "reality-error" && editionId === "current")
    return getPrivateFictionDocument(client);
  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucketName(),
        Key: workObjectKey(workId, editionId),
      }),
    );
    if (!response.ETag || !response.LastModified)
      throw new PrivateFictionStorageError("storage_unavailable");
    return {
      etag: response.ETag,
      source: await bodyText(response.Body),
      updatedAt: response.LastModified.toISOString(),
    };
  } catch (error) {
    if (error instanceof PrivateFictionStorageError) throw error;
    if (isMissing(error)) return undefined;
    throw new PrivateFictionStorageError("storage_unavailable");
  }
}

export async function savePrivateFictionEdition(
  workId: string,
  editionId: string,
  input: { expectedEtag: string | null; source: string },
  client = new S3Client({}),
) {
  if (workId === "reality-error" && editionId === "current")
    return savePrivateFictionDocument(input, client);
  if (
    new TextEncoder().encode(input.source).byteLength >
    MAX_PRIVATE_FICTION_SOURCE_BYTES
  )
    throw new PrivateFictionStorageError("storage_unavailable");
  try {
    const response = await client.send(
      new PutObjectCommand({
        Body: input.source,
        Bucket: bucketName(),
        CacheControl: "private, no-store, max-age=0",
        ContentType: "text/markdown; charset=utf-8",
        IfMatch: input.expectedEtag ?? undefined,
        IfNoneMatch: input.expectedEtag === null ? "*" : undefined,
        Key: workObjectKey(workId, editionId),
      }),
    );
    if (!response.ETag)
      throw new PrivateFictionStorageError("storage_unavailable");
    return { etag: response.ETag, updatedAt: new Date().toISOString() };
  } catch (error) {
    if (error instanceof PrivateFictionStorageError) throw error;
    if (isConflict(error)) throw new PrivateFictionStorageError("conflict");
    throw new PrivateFictionStorageError("storage_unavailable");
  }
}

export class PrivateFictionStorageError extends Error {
  constructor(readonly code: "conflict" | "storage_unavailable") {
    super(code);
    this.name = "PrivateFictionStorageError";
  }
}

function bucketName() {
  const bucket = serverEnv.PRIVATE_FICTION_BUCKET;
  if (!bucket) throw new PrivateFictionStorageError("storage_unavailable");
  return bucket;
}

async function bodyText(body: unknown) {
  if (!body || typeof body !== "object" || !("transformToString" in body))
    throw new PrivateFictionStorageError("storage_unavailable");
  return (
    body as { transformToString: () => Promise<string> }
  ).transformToString();
}

function isMissing(error: unknown) {
  const value = error as {
    $metadata?: { httpStatusCode?: number };
    name?: string;
  };
  return (
    value?.$metadata?.httpStatusCode === 404 || value?.name === "NoSuchKey"
  );
}

function isConflict(error: unknown) {
  const value = error as {
    $metadata?: { httpStatusCode?: number };
    name?: string;
  };
  return (
    value?.$metadata?.httpStatusCode === 412 ||
    value?.name === "PreconditionFailed"
  );
}

function isAccessDenied(error: unknown) {
  const value = error as {
    $metadata?: { httpStatusCode?: number };
    name?: string;
  };
  return (
    value?.$metadata?.httpStatusCode === 403 || value?.name === "AccessDenied"
  );
}

export async function getPrivateFictionDocument(
  client = new S3Client({}),
): Promise<PrivateFictionDocument | undefined> {
  try {
    const response = await client.send(
      new GetObjectCommand({ Bucket: bucketName(), Key: OBJECT_KEY }),
    );
    if (!response.ETag || !response.LastModified)
      throw new PrivateFictionStorageError("storage_unavailable");
    return {
      etag: response.ETag,
      source: await bodyText(response.Body),
      updatedAt: response.LastModified.toISOString(),
    };
  } catch (error) {
    if (error instanceof PrivateFictionStorageError) throw error;
    if (isMissing(error)) return undefined;
    throw new PrivateFictionStorageError("storage_unavailable");
  }
}

export async function savePrivateFictionDocument(
  input: {
    expectedEtag: string | null;
    source: string;
  },
  client = new S3Client({}),
) {
  if (
    new TextEncoder().encode(input.source).byteLength >
    MAX_PRIVATE_FICTION_SOURCE_BYTES
  )
    throw new PrivateFictionStorageError("storage_unavailable");
  try {
    const response = await client.send(
      new PutObjectCommand({
        Body: input.source,
        Bucket: bucketName(),
        CacheControl: "private, no-store, max-age=0",
        ContentType: "text/markdown; charset=utf-8",
        IfMatch: input.expectedEtag ?? undefined,
        IfNoneMatch: input.expectedEtag === null ? "*" : undefined,
        Key: OBJECT_KEY,
      }),
    );
    if (!response.ETag)
      throw new PrivateFictionStorageError("storage_unavailable");
    return { etag: response.ETag, updatedAt: new Date().toISOString() };
  } catch (error) {
    if (error instanceof PrivateFictionStorageError) throw error;
    if (isConflict(error)) throw new PrivateFictionStorageError("conflict");
    throw new PrivateFictionStorageError("storage_unavailable");
  }
}

async function readPrivateFictionAnnotations(
  client: S3Client,
  objectKey = ANNOTATIONS_OBJECT_KEY,
): Promise<PrivateFictionAnnotationsDocument> {
  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucketName(),
      Key: objectKey,
    }),
  );
  if (!response.ETag || !response.LastModified)
    throw new PrivateFictionStorageError("storage_unavailable");
  const parsed: unknown = JSON.parse(await bodyText(response.Body));
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !Array.isArray((parsed as { annotations?: unknown }).annotations)
  )
    throw new PrivateFictionStorageError("storage_unavailable");
  return {
    etag: response.ETag,
    annotations: (parsed as { annotations: PrivateFictionAnnotation[] })
      .annotations,
    updatedAt: response.LastModified.toISOString(),
  };
}

export async function getPrivateFictionAnnotations(
  client = new S3Client({}),
): Promise<PrivateFictionAnnotationsDocument | undefined> {
  try {
    return await readPrivateFictionAnnotations(client);
  } catch (error) {
    if (error instanceof PrivateFictionStorageError) throw error;
    if (isMissing(error)) return undefined;
    // Without ListBucket, S3 also returns 403 for a key that does not exist.
    // A conditional create distinguishes that case without widening permissions
    // or overwriting feedback. A competing/existing object must be read instead.
    if (isAccessDenied(error)) {
      try {
        return await savePrivateFictionAnnotations(
          { expectedEtag: null, annotations: [] },
          client,
        );
      } catch (initializationError) {
        if (
          initializationError instanceof PrivateFictionStorageError &&
          initializationError.code === "conflict"
        ) {
          try {
            return await readPrivateFictionAnnotations(client);
          } catch {
            throw new PrivateFictionStorageError("storage_unavailable");
          }
        }
      }
    }
    throw new PrivateFictionStorageError("storage_unavailable");
  }
}

export async function savePrivateFictionAnnotations(
  input: {
    expectedEtag: string | null;
    annotations: PrivateFictionAnnotation[];
  },
  client = new S3Client({}),
  objectKey = ANNOTATIONS_OBJECT_KEY,
) {
  const body = JSON.stringify({ annotations: input.annotations });
  if (
    new TextEncoder().encode(body).byteLength >
    MAX_PRIVATE_FICTION_ANNOTATION_BYTES
  )
    throw new PrivateFictionStorageError("storage_unavailable");
  try {
    const response = await client.send(
      new PutObjectCommand({
        Body: body,
        Bucket: bucketName(),
        CacheControl: "private, no-store, max-age=0",
        ContentType: "application/json; charset=utf-8",
        IfMatch: input.expectedEtag ?? undefined,
        IfNoneMatch: input.expectedEtag === null ? "*" : undefined,
        Key: objectKey,
      }),
    );
    if (!response.ETag)
      throw new PrivateFictionStorageError("storage_unavailable");
    return {
      etag: response.ETag,
      annotations: input.annotations,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof PrivateFictionStorageError) throw error;
    if (isConflict(error)) throw new PrivateFictionStorageError("conflict");
    throw new PrivateFictionStorageError("storage_unavailable");
  }
}

export async function getPrivateFictionEditionAnnotations(
  workId: string,
  editionId: string,
  client = new S3Client({}),
): Promise<PrivateFictionAnnotationsDocument | undefined> {
  const key =
    workId === "reality-error" && editionId === "current"
      ? ANNOTATIONS_OBJECT_KEY
      : annotationsObjectKey(workId, editionId);
  try {
    return await readPrivateFictionAnnotations(client, key);
  } catch (error) {
    if (error instanceof PrivateFictionStorageError) throw error;
    if (isMissing(error)) return undefined;
    if (isAccessDenied(error)) {
      try {
        return await savePrivateFictionAnnotations(
          { expectedEtag: null, annotations: [] },
          client,
          key,
        );
      } catch (initializationError) {
        if (
          initializationError instanceof PrivateFictionStorageError &&
          initializationError.code === "conflict"
        ) {
          try {
            return await readPrivateFictionAnnotations(client, key);
          } catch {
            throw new PrivateFictionStorageError("storage_unavailable");
          }
        }
      }
    }
    throw new PrivateFictionStorageError("storage_unavailable");
  }
}

export function savePrivateFictionEditionAnnotations(
  workId: string,
  editionId: string,
  input: {
    expectedEtag: string | null;
    annotations: PrivateFictionAnnotation[];
  },
  client = new S3Client({}),
) {
  const key =
    workId === "reality-error" && editionId === "current"
      ? ANNOTATIONS_OBJECT_KEY
      : annotationsObjectKey(workId, editionId);
  return savePrivateFictionAnnotations(input, client, key);
}
