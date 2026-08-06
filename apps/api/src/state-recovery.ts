import { serverEnv } from "@acme/env/server-env";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

function required(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} is required for state recovery`);
  return value;
}

function safeSourceKey(sourceKey: string, prefix: string) {
  const normalizedPrefix = prefix.replace(/^\/|\/$/g, "");
  if (
    !sourceKey.startsWith(`${normalizedPrefix}/`) ||
    sourceKey.includes("..") ||
    sourceKey.startsWith(`${normalizedPrefix}/recovery/`)
  )
    throw new Error("Recovery source must be a non-recovery Beat state key");
  return sourceKey;
}

function recoveryKey(sourceKey: string, prefix: string, now: Date) {
  const normalizedPrefix = prefix.replace(/^\/|\/$/g, "");
  const timestamp = now.toISOString().replaceAll(":", "-");
  const relative = sourceKey.slice(normalizedPrefix.length + 1);
  return `${normalizedPrefix}/recovery/${timestamp}/${relative}`;
}

/**
 * Copies one immutable version into a quarantine prefix. It never replaces a
 * live head; an operator must inspect the recovered JSON before a separate,
 * revision-checked promotion.
 */
export async function recoverBeatStateVersion(
  input: { sourceKey: string; versionId: string },
  client = new S3Client({}),
  now = new Date(),
) {
  const bucket = required(
    serverEnv.BEAT_AUTH_STATE_BUCKET,
    "BEAT_AUTH_STATE_BUCKET",
  );
  const sourceKey = safeSourceKey(
    input.sourceKey,
    serverEnv.BEAT_AUTH_STATE_PREFIX,
  );
  const source = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: sourceKey,
      VersionId: input.versionId,
    }),
  );
  if (!source.Body || !("transformToByteArray" in source.Body))
    throw new Error("Recovery source body is unavailable");
  const body = await source.Body.transformToByteArray();
  const destinationKey = recoveryKey(
    sourceKey,
    serverEnv.BEAT_AUTH_STATE_PREFIX,
    now,
  );
  await client.send(
    new PutObjectCommand({
      Body: body,
      Bucket: bucket,
      ContentType: source.ContentType ?? "application/json",
      IfNoneMatch: "*",
      Key: destinationKey,
      Metadata: {
        "beat-recovery-source-key": encodeURIComponent(sourceKey),
        "beat-recovery-source-version": input.versionId,
      },
    }),
  );
  return { bucket, destinationKey, sourceKey, versionId: input.versionId };
}
