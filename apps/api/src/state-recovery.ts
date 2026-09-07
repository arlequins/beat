import { serverEnv } from "@arlequins/env/server-env";
import {
  GetObjectCommand,
  ListObjectVersionsCommand,
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

/**
 * Checks that recovery has an immutable S3 version to select without reading
 * object bodies or changing a live or recovery prefix.
 *
 * This is deliberately weaker than `recoverBeatStateVersion`: a scheduled
 * check only proves that version history is visible. An operator must still
 * provide an explicit key and version for a quarantined recovery.
 */
export async function inspectBeatStateRecoveryReadiness(
  client = new S3Client({}),
) {
  const bucket = required(
    serverEnv.BEAT_AUTH_STATE_BUCKET,
    "BEAT_AUTH_STATE_BUCKET",
  );
  const prefix = serverEnv.BEAT_AUTH_STATE_PREFIX.replace(/^\/|\/$/g, "");
  const response = await client.send(
    new ListObjectVersionsCommand({
      Bucket: bucket,
      MaxKeys: 25,
      Prefix: `${prefix}/`,
    }),
  );
  const candidate = (response.Versions ?? []).find(
    (version) =>
      Boolean(version.Key && version.VersionId) &&
      !version.Key?.startsWith(`${prefix}/recovery/`),
  );

  return {
    immutableVersion: candidate ? "available" : "no-state-objects",
    mode: "read-only" as const,
  };
}
