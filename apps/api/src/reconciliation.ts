import { createHash } from "node:crypto";

import { serverEnv } from "@arlequins/env/server-env";
import {
  ListObjectVersionsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { reconcileBeatPublicationJobs } from "./features/content/infrastructure/s3-content-repository";

type AuditConfig = {
  ledgerBucket: string;
  ledgerRetentionDays?: number;
  stateBucket: string;
  statePrefix: string;
};

type VersionEvidence = {
  etag?: string;
  isDeleteMarker: boolean;
  isLatest: boolean;
  key: string;
  lastModified: string;
  versionId: string;
};

export type StateAuditSummary = {
  checked: number;
  existingEvidence: number;
  failures: { key: string; message: string }[];
  newEvidence: number;
  unexpectedDeleteMarkers: number;
};

export type ReconciliationSummary = {
  publication: Awaited<ReturnType<typeof reconcileBeatPublicationJobs>>;
  stateAudit: StateAuditSummary;
};

function required(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} is required for reconciliation`);
  return value;
}

function config(): AuditConfig {
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

function evidenceKey(value: VersionEvidence) {
  const digest = createHash("sha256")
    .update(value.key)
    .update("\0")
    .update(value.versionId)
    .update("\0")
    .update(value.etag ?? "delete-marker")
    .digest("hex");
  const date = value.lastModified.slice(0, 10).replaceAll("-", "/");
  return `v1/events/system/${date}/state-version-${digest}.json`;
}

async function writeEvidence(
  value: VersionEvidence,
  client: S3Client,
  auditConfig: AuditConfig,
) {
  const now = new Date();
  const lockUntil = auditConfig.ledgerRetentionDays
    ? new Date(
        now.getTime() + auditConfig.ledgerRetentionDays * 24 * 60 * 60 * 1_000,
      )
    : undefined;
  await client.send(
    new PutObjectCommand({
      Body: JSON.stringify({
        details: {
          etag: value.etag,
          isDeleteMarker: value.isDeleteMarker,
          isLatest: value.isLatest,
          sourceKey: value.key,
          sourceVersionId: value.versionId,
        },
        eventId: createHash("sha256")
          .update(`${value.key}\0${value.versionId}`)
          .digest("hex"),
        occurredAt: value.lastModified,
        reconciledAt: now.toISOString(),
        schemaVersion: 1,
        type: value.isDeleteMarker
          ? "unexpected-state-delete-marker"
          : "state-version-reconciled",
      }),
      Bucket: auditConfig.ledgerBucket,
      ContentType: "application/json",
      IfNoneMatch: "*",
      Key: evidenceKey(value),
      ...(lockUntil
        ? {
            ObjectLockMode: "COMPLIANCE" as const,
            ObjectLockRetainUntilDate: lockUntil,
          }
        : {}),
    }),
  );
}

/**
 * Produces deterministic immutable evidence for every durable S3 state object
 * version. It never reads object bodies, so password and refresh-token hashes
 * cannot be copied into logs or the audit ledger.
 */
export async function reconcileStateVersionAudit(
  client = new S3Client({}),
): Promise<StateAuditSummary> {
  const auditConfig = config();
  const prefixes = [
    `${auditConfig.statePrefix}/admins/`,
    `${auditConfig.statePrefix}/drafts/`,
    `${auditConfig.statePrefix}/publication-jobs/`,
    `${auditConfig.statePrefix}/gourmet/`,
  ];
  const summary: StateAuditSummary = {
    checked: 0,
    existingEvidence: 0,
    failures: [],
    newEvidence: 0,
    unexpectedDeleteMarkers: 0,
  };

  for (const prefix of prefixes) {
    let keyMarker: string | undefined;
    let versionIdMarker: string | undefined;
    do {
      const page = await client.send(
        new ListObjectVersionsCommand({
          Bucket: auditConfig.stateBucket,
          KeyMarker: keyMarker,
          Prefix: prefix,
          VersionIdMarker: versionIdMarker,
        }),
      );
      const values: VersionEvidence[] = [
        ...(page.Versions ?? []).flatMap((version) =>
          version.Key && version.VersionId && version.LastModified
            ? [
                {
                  etag: version.ETag,
                  isDeleteMarker: false,
                  isLatest: version.IsLatest ?? false,
                  key: version.Key,
                  lastModified: version.LastModified.toISOString(),
                  versionId: version.VersionId,
                },
              ]
            : [],
        ),
        ...(page.DeleteMarkers ?? []).flatMap((marker) =>
          marker.Key && marker.VersionId && marker.LastModified
            ? [
                {
                  isDeleteMarker: true,
                  isLatest: marker.IsLatest ?? false,
                  key: marker.Key,
                  lastModified: marker.LastModified.toISOString(),
                  versionId: marker.VersionId,
                },
              ]
            : [],
        ),
      ];
      for (const value of values) {
        summary.checked += 1;
        if (value.isDeleteMarker) summary.unexpectedDeleteMarkers += 1;
        try {
          await writeEvidence(value, client, auditConfig);
          summary.newEvidence += 1;
        } catch (error) {
          if (isPreconditionFailed(error)) {
            summary.existingEvidence += 1;
            continue;
          }
          summary.failures.push({
            key: value.key,
            message: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
      keyMarker = page.IsTruncated ? page.NextKeyMarker : undefined;
      versionIdMarker = page.IsTruncated ? page.NextVersionIdMarker : undefined;
    } while (keyMarker);
  }

  return summary;
}

export async function reconcileBeatProductionState(
  client = new S3Client({}),
  request: typeof fetch = fetch,
): Promise<ReconciliationSummary> {
  const publication = await reconcileBeatPublicationJobs(client, request);
  const stateAudit = await reconcileStateVersionAudit(client);
  return { publication, stateAudit };
}
