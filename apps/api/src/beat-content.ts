import { randomUUID } from "node:crypto";

import { serverEnv } from "@arlequins/env/server-env";
import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { createGitHubInstallationToken } from "./github-app";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_MDX_BYTES = 256 * 1_024;

export type BeatDraft = {
  revision: number;
  schemaVersion: 1;
  slug: string;
  source: string;
  status: "draft" | "confirmed";
  title: string;
  updatedAt: string;
  updatedBy: string;
};

export type PublicationJob = {
  branch: string;
  completedAt?: string;
  draftRevision: number;
  idempotencyKey: string;
  prUrl?: string;
  schemaVersion: 1;
  slug: string;
  status: "closed" | "merged" | "opened" | "pending";
  updatedAt: string;
};

type Stored<T> = {
  etag: string;
  value: T;
};

type ContentConfig = {
  ledgerBucket: string;
  ledgerRetentionDays?: number;
  repository: string;
  stateBucket: string;
  statePrefix: string;
};

export class BeatContentError extends Error {
  constructor(readonly code: "conflict" | "invalid_draft" | "not_found") {
    super(code);
    this.name = "BeatContentError";
  }
}

function required(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} is required for Beat content`);
  return value;
}

function config(): ContentConfig {
  return {
    ledgerBucket: required(
      serverEnv.BEAT_AUTH_LEDGER_BUCKET,
      "BEAT_AUTH_LEDGER_BUCKET",
    ),
    ledgerRetentionDays: serverEnv.BEAT_AUTH_LEDGER_RETENTION_DAYS,
    repository: required(
      serverEnv.GITHUB_CONTENT_REPOSITORY,
      "GITHUB_CONTENT_REPOSITORY",
    ),
    stateBucket: required(
      serverEnv.BEAT_AUTH_STATE_BUCKET,
      "BEAT_AUTH_STATE_BUCKET",
    ),
    statePrefix: serverEnv.BEAT_AUTH_STATE_PREFIX.replace(/^\/|\/$/g, ""),
  };
}

function validateSlug(slug: string) {
  if (!SLUG_PATTERN.test(slug)) throw new BeatContentError("invalid_draft");
  return slug;
}

function validateDraftInput(input: { source: string; title: string }) {
  if (
    input.title.trim().length < 1 ||
    input.title.length > 200 ||
    !input.source.startsWith("---\n") ||
    Buffer.byteLength(input.source, "utf8") > MAX_MDX_BYTES
  )
    throw new BeatContentError("invalid_draft");
}

function headKey(slug: string, contentConfig: ContentConfig) {
  return `${contentConfig.statePrefix}/drafts/${slug}/head.json`;
}

function revisionKey(
  slug: string,
  revision: number,
  contentConfig: ContentConfig,
) {
  return `${contentConfig.statePrefix}/drafts/${slug}/revisions/${revision}.json`;
}

function jobKey(slug: string, revision: number, contentConfig: ContentConfig) {
  return `${contentConfig.statePrefix}/publication-jobs/${slug}/${revision}.json`;
}

function isMissing(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    $metadata?: { httpStatusCode?: number };
    name?: string;
  };
  return (
    candidate.$metadata?.httpStatusCode === 404 ||
    candidate.name === "NoSuchKey" ||
    candidate.name === "NotFound"
  );
}

function isConflict(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    $metadata?: { httpStatusCode?: number };
    name?: string;
  };
  return (
    candidate.$metadata?.httpStatusCode === 412 ||
    candidate.name === "PreconditionFailed"
  );
}

async function bodyText(body: unknown) {
  if (!body || typeof body !== "object" || !("transformToString" in body))
    throw new Error("Invalid S3 content object body");
  return (
    body as { transformToString: () => Promise<string> }
  ).transformToString();
}

async function getJson<T>(
  client: S3Client,
  bucket: string,
  key: string,
): Promise<Stored<T> | undefined> {
  try {
    const response = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    if (!response.ETag)
      throw new Error(`S3 object ${key} did not include an ETag`);
    return {
      etag: response.ETag,
      value: JSON.parse(await bodyText(response.Body)) as T,
    };
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

function isDraft(value: unknown): value is BeatDraft {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    row.schemaVersion === 1 &&
    typeof row.revision === "number" &&
    typeof row.slug === "string" &&
    typeof row.source === "string" &&
    (row.status === "draft" || row.status === "confirmed") &&
    typeof row.title === "string" &&
    typeof row.updatedAt === "string" &&
    typeof row.updatedBy === "string"
  );
}

function isPublicationJob(value: unknown): value is PublicationJob {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    row.schemaVersion === 1 &&
    typeof row.branch === "string" &&
    typeof row.draftRevision === "number" &&
    typeof row.idempotencyKey === "string" &&
    typeof row.slug === "string" &&
    (row.status === "pending" ||
      row.status === "opened" ||
      row.status === "merged" ||
      row.status === "closed") &&
    typeof row.updatedAt === "string"
  );
}

async function appendContentEvent(
  type: string,
  details: Record<string, unknown>,
  client: S3Client,
  contentConfig: ContentConfig,
) {
  const now = new Date();
  const timestamp = now.toISOString();
  const lockUntil = contentConfig.ledgerRetentionDays
    ? new Date(
        now.getTime() +
          contentConfig.ledgerRetentionDays * 24 * 60 * 60 * 1_000,
      )
    : undefined;
  await putJson(client, {
    bucket: contentConfig.ledgerBucket,
    ifNoneMatch: "*",
    key: `v1/events/content/${timestamp.slice(0, 10).replaceAll("-", "/")}/${timestamp}-${randomUUID()}.json`,
    lockUntil,
    value: {
      details,
      eventId: randomUUID(),
      occurredAt: timestamp,
      schemaVersion: 1,
      type,
    },
  });
}

export async function getBeatDraft(slug: string, client = new S3Client({})) {
  const contentConfig = config();
  const stored = await getJson<BeatDraft>(
    client,
    contentConfig.stateBucket,
    headKey(validateSlug(slug), contentConfig),
  );
  if (!stored) return undefined;
  if (!isDraft(stored.value)) throw new Error("Invalid S3 draft state");
  return stored.value;
}

export async function saveBeatDraft(
  input: {
    expectedRevision: number;
    slug: string;
    source: string;
    title: string;
    updatedBy: string;
  },
  client = new S3Client({}),
) {
  validateDraftInput(input);
  const contentConfig = config();
  const slug = validateSlug(input.slug);
  const key = headKey(slug, contentConfig);
  const current = await getJson<BeatDraft>(
    client,
    contentConfig.stateBucket,
    key,
  );
  if (current && !isDraft(current.value))
    throw new Error("Invalid S3 draft state");
  const currentRevision = current?.value.revision ?? 0;
  if (currentRevision !== input.expectedRevision)
    throw new BeatContentError("conflict");
  const draft: BeatDraft = {
    revision: currentRevision + 1,
    schemaVersion: 1,
    slug,
    source: input.source,
    status: "draft",
    title: input.title.trim(),
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy,
  };
  try {
    await putJson(client, {
      bucket: contentConfig.stateBucket,
      ifNoneMatch: "*",
      key: revisionKey(slug, draft.revision, contentConfig),
      value: draft,
    });
    await putJson(client, {
      bucket: contentConfig.stateBucket,
      ifMatch: current?.etag,
      ifNoneMatch: current ? undefined : "*",
      key,
      value: draft,
    });
  } catch (error) {
    if (isConflict(error)) throw new BeatContentError("conflict");
    throw error;
  }
  await appendContentEvent(
    "draft-saved",
    { revision: draft.revision, slug, subject: input.updatedBy },
    client,
    contentConfig,
  );
  return draft;
}

async function confirmBeatDraft(
  slug: string,
  expectedRevision: number,
  subject: string,
  client: S3Client,
  contentConfig: ContentConfig,
) {
  const key = headKey(slug, contentConfig);
  const current = await getJson<BeatDraft>(
    client,
    contentConfig.stateBucket,
    key,
  );
  if (!current) throw new BeatContentError("not_found");
  if (!isDraft(current.value)) throw new Error("Invalid S3 draft state");
  if (current.value.revision !== expectedRevision)
    throw new BeatContentError("conflict");
  if (current.value.status === "confirmed") return current.value;
  const confirmed: BeatDraft = {
    ...current.value,
    revision: current.value.revision + 1,
    status: "confirmed",
    updatedAt: new Date().toISOString(),
    updatedBy: subject,
  };
  try {
    await putJson(client, {
      bucket: contentConfig.stateBucket,
      ifNoneMatch: "*",
      key: revisionKey(slug, confirmed.revision, contentConfig),
      value: confirmed,
    });
    await putJson(client, {
      bucket: contentConfig.stateBucket,
      ifMatch: current.etag,
      key,
      value: confirmed,
    });
  } catch (error) {
    if (isConflict(error)) throw new BeatContentError("conflict");
    throw error;
  }
  await appendContentEvent(
    "draft-confirmed",
    { revision: confirmed.revision, slug, subject },
    client,
    contentConfig,
  );
  return confirmed;
}

async function githubRequest<T>(
  request: typeof fetch,
  token: string,
  url: string,
  init?: RequestInit,
): Promise<{ response: Response; value?: T }> {
  const response = await request(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2026-03-10",
      ...init?.headers,
    },
  });
  const value =
    response.status === 204 ? undefined : ((await response.json()) as T);
  return { response, value };
}

async function openGitHubPullRequest(
  draft: BeatDraft,
  branch: string,
  request: typeof fetch,
  contentConfig: ContentConfig,
) {
  const installation = await createGitHubInstallationToken(request);
  const baseUrl = `https://api.github.com/repos/${contentConfig.repository}`;
  const main = await githubRequest<{ object?: { sha?: string } }>(
    request,
    installation.token,
    `${baseUrl}/git/ref/heads/main`,
  );
  const mainSha = main.value?.object?.sha;
  if (!main.response.ok || !mainSha)
    throw new Error(`GitHub main ref lookup failed (${main.response.status})`);

  const branchResult = await githubRequest(
    request,
    installation.token,
    `${baseUrl}/git/refs`,
    {
      body: JSON.stringify({
        ref: `refs/heads/${branch}`,
        sha: mainSha,
      }),
      method: "POST",
    },
  );
  if (!branchResult.response.ok && branchResult.response.status !== 422)
    throw new Error(
      `GitHub branch creation failed (${branchResult.response.status})`,
    );

  const path = `apps/web/content/posts/${draft.slug}.mdx`;
  const existing = await githubRequest<{ sha?: string }>(
    request,
    installation.token,
    `${baseUrl}/contents/${path}?ref=${encodeURIComponent(branch)}`,
  );
  if (!existing.response.ok && existing.response.status !== 404)
    throw new Error(
      `GitHub content lookup failed (${existing.response.status})`,
    );
  const contentResult = await githubRequest(
    request,
    installation.token,
    `${baseUrl}/contents/${path}`,
    {
      body: JSON.stringify({
        branch,
        content: Buffer.from(draft.source).toString("base64"),
        message: `content: review ${draft.slug}`,
        ...(existing.value?.sha ? { sha: existing.value.sha } : {}),
      }),
      method: "PUT",
    },
  );
  if (!contentResult.response.ok)
    throw new Error(
      `GitHub content update failed (${contentResult.response.status})`,
    );

  const pull = await githubRequest<{ html_url?: string }>(
    request,
    installation.token,
    `${baseUrl}/pulls`,
    {
      body: JSON.stringify({
        base: "main",
        body: `Beat S3 draft revision ${draft.revision}. Review and merge this pull request to publish.`,
        head: branch,
        title: `content: review ${draft.title}`,
      }),
      method: "POST",
    },
  );
  const prUrl = pull.value?.html_url;
  if (pull.response.ok && prUrl) return prUrl;
  if (pull.response.status === 422) {
    const owner = contentConfig.repository.split("/")[0];
    const existingPulls = await githubRequest<{ html_url?: string }[]>(
      request,
      installation.token,
      `${baseUrl}/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}&base=main`,
    );
    const existingUrl = existingPulls.value?.[0]?.html_url;
    if (existingPulls.response.ok && existingUrl) return existingUrl;
  }
  throw new Error(`GitHub pull request failed (${pull.response.status})`);
}

export async function confirmAndPublishBeatDraft(
  input: {
    expectedRevision: number;
    slug: string;
    subject: string;
  },
  client = new S3Client({}),
  request: typeof fetch = fetch,
) {
  const contentConfig = config();
  const slug = validateSlug(input.slug);
  const draft = await confirmBeatDraft(
    slug,
    input.expectedRevision,
    input.subject,
    client,
    contentConfig,
  );
  const key = jobKey(slug, draft.revision, contentConfig);
  const existing = await getJson<PublicationJob>(
    client,
    contentConfig.stateBucket,
    key,
  );
  if (existing) {
    if (!isPublicationJob(existing.value))
      throw new Error("Invalid publication job state");
    if (existing.value.status !== "pending") return existing.value;
  }
  const branch = `content/${slug}-r${draft.revision}`;
  const pending: PublicationJob = existing?.value ?? {
    branch,
    draftRevision: draft.revision,
    idempotencyKey: `${slug}:${draft.revision}`,
    schemaVersion: 1,
    slug,
    status: "pending",
    updatedAt: new Date().toISOString(),
  };
  if (!existing) {
    try {
      await putJson(client, {
        bucket: contentConfig.stateBucket,
        ifNoneMatch: "*",
        key,
        value: pending,
      });
    } catch (error) {
      if (!isConflict(error)) throw error;
    }
  }
  const prUrl = await openGitHubPullRequest(
    draft,
    branch,
    request,
    contentConfig,
  );
  const current = await getJson<PublicationJob>(
    client,
    contentConfig.stateBucket,
    key,
  );
  if (!current || !isPublicationJob(current.value))
    throw new Error("Publication job disappeared");
  const opened: PublicationJob = {
    ...current.value,
    prUrl,
    status: "opened",
    updatedAt: new Date().toISOString(),
  };
  try {
    await putJson(client, {
      bucket: contentConfig.stateBucket,
      ifMatch: current.etag,
      key,
      value: opened,
    });
  } catch (error) {
    if (isConflict(error)) throw new BeatContentError("conflict");
    throw error;
  }
  await appendContentEvent(
    "publication-pr-opened",
    {
      prUrl,
      revision: draft.revision,
      slug,
      subject: input.subject,
    },
    client,
    contentConfig,
  );
  return opened;
}

async function publicationJobKeys(
  client: S3Client,
  contentConfig: ContentConfig,
) {
  const keys: string[] = [];
  let continuationToken: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: contentConfig.stateBucket,
        ContinuationToken: continuationToken,
        Prefix: `${contentConfig.statePrefix}/publication-jobs/`,
      }),
    );
    for (const object of page.Contents ?? []) {
      if (object.Key?.endsWith(".json")) keys.push(object.Key);
    }
    continuationToken = page.IsTruncated
      ? page.NextContinuationToken
      : undefined;
  } while (continuationToken);
  return keys;
}

function pullRequestNumber(prUrl: string, repository: string) {
  const url = new URL(prUrl);
  const [owner, name, segment, number, ...extra] = url.pathname
    .split("/")
    .filter(Boolean);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    `${owner}/${name}` !== repository ||
    segment !== "pull" ||
    extra.length > 0 ||
    !number ||
    !/^\d+$/.test(number)
  )
    throw new Error("Publication job has an invalid GitHub pull request URL");
  return Number(number);
}

async function pullRequestState(
  prUrl: string,
  request: typeof fetch,
  contentConfig: ContentConfig,
) {
  const installation = await createGitHubInstallationToken(request);
  const number = pullRequestNumber(prUrl, contentConfig.repository);
  const pull = await githubRequest<{
    closed_at?: string | null;
    merged_at?: string | null;
    state?: "closed" | "open";
  }>(
    request,
    installation.token,
    `https://api.github.com/repos/${contentConfig.repository}/pulls/${number}`,
  );
  if (!pull.response.ok || !pull.value?.state)
    throw new Error(
      `GitHub pull request lookup failed (${pull.response.status})`,
    );
  if (pull.value.merged_at)
    return { completedAt: pull.value.merged_at, status: "merged" as const };
  if (pull.value.state === "closed")
    return {
      completedAt: pull.value.closed_at ?? new Date().toISOString(),
      status: "closed" as const,
    };
  return { status: "opened" as const };
}

export type PublicationReconciliationSummary = {
  checked: number;
  closed: number;
  failures: { key: string; message: string }[];
  merged: number;
  opened: number;
};

/**
 * Replays interrupted publication jobs and records the terminal GitHub PR
 * state. Each write uses the current S3 ETag, so concurrent API and scheduled
 * executions fail closed instead of overwriting one another.
 */
export async function reconcileBeatPublicationJobs(
  client = new S3Client({}),
  request: typeof fetch = fetch,
): Promise<PublicationReconciliationSummary> {
  const contentConfig = config();
  const summary: PublicationReconciliationSummary = {
    checked: 0,
    closed: 0,
    failures: [],
    merged: 0,
    opened: 0,
  };
  for (const key of await publicationJobKeys(client, contentConfig)) {
    summary.checked += 1;
    try {
      const stored = await getJson<PublicationJob>(
        client,
        contentConfig.stateBucket,
        key,
      );
      if (!stored || !isPublicationJob(stored.value))
        throw new Error("Invalid publication job state");
      if (stored.value.status === "merged" || stored.value.status === "closed")
        continue;

      let next: PublicationJob | undefined;
      let eventType: string | undefined;
      if (stored.value.status === "pending") {
        const draft = await getJson<BeatDraft>(
          client,
          contentConfig.stateBucket,
          revisionKey(
            stored.value.slug,
            stored.value.draftRevision,
            contentConfig,
          ),
        );
        if (!draft || !isDraft(draft.value))
          throw new Error("Publication draft revision is missing or invalid");
        const prUrl = await openGitHubPullRequest(
          draft.value,
          stored.value.branch,
          request,
          contentConfig,
        );
        next = {
          ...stored.value,
          prUrl,
          status: "opened",
          updatedAt: new Date().toISOString(),
        };
        eventType = "publication-pr-reconciled";
        summary.opened += 1;
      } else if (stored.value.prUrl) {
        const state = await pullRequestState(
          stored.value.prUrl,
          request,
          contentConfig,
        );
        if (state.status !== "opened") {
          next = {
            ...stored.value,
            completedAt: state.completedAt,
            status: state.status,
            updatedAt: new Date().toISOString(),
          };
          eventType = `publication-pr-${state.status}`;
          summary[state.status] += 1;
        }
      }
      if (!next || !eventType) continue;
      await putJson(client, {
        bucket: contentConfig.stateBucket,
        ifMatch: stored.etag,
        key,
        value: next,
      });
      await appendContentEvent(
        eventType,
        {
          prUrl: next.prUrl,
          revision: next.draftRevision,
          slug: next.slug,
          subject: "system:reconciler",
        },
        client,
        contentConfig,
      );
    } catch (error) {
      summary.failures.push({
        key,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  return summary;
}
