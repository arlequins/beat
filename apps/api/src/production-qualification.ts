import { randomUUID } from "node:crypto";

import { serverEnv } from "@acme/env/server-env";
import {
  GetBucketLifecycleConfigurationCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

function required(value: string | undefined, name: string) {
  if (!value)
    throw new Error(`${name} is required for production qualification`);
  return value;
}

function isPreconditionFailed(error: unknown) {
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

/**
 * Performs deliberate, non-destructive writes against real production S3.
 * Qualification objects remain as evidence; the ledger object is protected by
 * Compliance Object Lock and must never be targeted by cleanup automation.
 */
export async function qualifyBeatProductionStorage(
  client = new S3Client({}),
  now = new Date(),
) {
  if (serverEnv.BEAT_PRODUCTION_QUALIFICATION_CONFIRM !== "production")
    throw new Error(
      "BEAT_PRODUCTION_QUALIFICATION_CONFIRM=production is required",
    );
  const stateBucket = required(
    serverEnv.BEAT_AUTH_STATE_BUCKET,
    "BEAT_AUTH_STATE_BUCKET",
  );
  const ledgerBucket = required(
    serverEnv.BEAT_AUTH_LEDGER_BUCKET,
    "BEAT_AUTH_LEDGER_BUCKET",
  );
  const prefix = serverEnv.BEAT_AUTH_STATE_PREFIX.replace(/^\/|\/$/g, "");
  const id = randomUUID();
  const stateKey = `${prefix}/qualification/${now.toISOString()}-${id}.json`;
  const firstBody = JSON.stringify({ id, revision: 1, schemaVersion: 1 });
  await Promise.all([
    client.send(new HeadBucketCommand({ Bucket: stateBucket })),
    client.send(new HeadBucketCommand({ Bucket: ledgerBucket })),
  ]);
  await client.send(
    new PutObjectCommand({
      Body: firstBody,
      Bucket: stateBucket,
      ContentType: "application/json",
      IfNoneMatch: "*",
      Key: stateKey,
    }),
  );
  const head = await client.send(
    new HeadObjectCommand({ Bucket: stateBucket, Key: stateKey }),
  );
  if (!head.ETag || !head.VersionId)
    throw new Error("State qualification object is not versioned");
  const contenders = await Promise.allSettled(
    [2, 3].map((revision) =>
      client.send(
        new PutObjectCommand({
          Body: JSON.stringify({ id, revision, schemaVersion: 1 }),
          Bucket: stateBucket,
          ContentType: "application/json",
          IfMatch: head.ETag,
          Key: stateKey,
        }),
      ),
    ),
  );
  const won = contenders.filter((result) => result.status === "fulfilled");
  const conflicts = contenders.filter(
    (result) =>
      result.status === "rejected" && isPreconditionFailed(result.reason),
  );
  if (won.length !== 1 || conflicts.length !== 1)
    throw new Error("S3 conditional-write qualification did not serialize");

  const ledgerKey = `v1/events/system/${now.toISOString().slice(0, 10).replaceAll("-", "/")}/${now.toISOString()}-${id}-qualification.json`;
  const retainUntil = new Date(now.getTime() + 24 * 60 * 60 * 1_000);
  const ledgerPut = await client.send(
    new PutObjectCommand({
      Body: JSON.stringify({
        eventId: id,
        occurredAt: now.toISOString(),
        schemaVersion: 1,
        type: "production-storage-qualified",
      }),
      Bucket: ledgerBucket,
      ContentType: "application/json",
      IfNoneMatch: "*",
      Key: ledgerKey,
      ObjectLockMode: "COMPLIANCE",
      ObjectLockRetainUntilDate: retainUntil,
    }),
  );
  if (!ledgerPut.VersionId)
    throw new Error("Ledger qualification object is not versioned");
  const ledgerHead = await client.send(
    new HeadObjectCommand({
      Bucket: ledgerBucket,
      Key: ledgerKey,
      VersionId: ledgerPut.VersionId,
    }),
  );
  if (
    ledgerHead.ObjectLockMode !== "COMPLIANCE" ||
    !ledgerHead.ObjectLockRetainUntilDate ||
    ledgerHead.ObjectLockRetainUntilDate < retainUntil
  )
    throw new Error("Ledger Object Lock qualification failed");

  const lifecycle = await client.send(
    new GetBucketLifecycleConfigurationCommand({ Bucket: stateBucket }),
  );
  const lifecycleRuleIds = (lifecycle.Rules ?? [])
    .map((rule) => rule.ID)
    .filter((value): value is string => Boolean(value));
  return {
    conditionalWrite: "one-winner-one-conflict" as const,
    ledgerKey,
    ledgerRetentionUntil: ledgerHead.ObjectLockRetainUntilDate.toISOString(),
    lifecycleRuleIds,
    stateKey,
    stateVersioning: "enabled" as const,
  };
}
