import { serverEnv } from "@arlequins/env/server-env";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const OBJECT_KEY = "author-vault/reality-error/outline.md";
const ANNOTATIONS_OBJECT_KEY = "author-vault/reality-error/annotations.json";
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
): Promise<PrivateFictionAnnotationsDocument> {
  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucketName(),
      Key: ANNOTATIONS_OBJECT_KEY,
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
        Key: ANNOTATIONS_OBJECT_KEY,
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
