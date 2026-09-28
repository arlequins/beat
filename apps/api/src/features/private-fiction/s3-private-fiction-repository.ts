import { serverEnv } from "@arlequins/env/server-env";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const OBJECT_KEY = "author-vault/reality-error/outline.md";
export const MAX_PRIVATE_FICTION_SOURCE_BYTES = 4_000_000;

export type PrivateFictionDocument = {
  etag: string;
  source: string;
  updatedAt: string;
};

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
