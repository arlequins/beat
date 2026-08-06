import {
  ListObjectVersionsCommand,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it, vi } from "vitest";

async function loadReconciliation() {
  vi.stubEnv("BEAT_AUTH_STATE_BUCKET", "beat-state");
  vi.stubEnv("BEAT_AUTH_LEDGER_BUCKET", "beat-ledger");
  vi.stubEnv("BEAT_AUTH_STATE_PREFIX", "v1");
  vi.stubEnv("BEAT_AUTH_LEDGER_RETENTION_DAYS", "365");
  vi.stubEnv("GITHUB_CONTENT_REPOSITORY", "arlequins/beat");
  vi.resetModules();
  return import("./reconciliation");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Beat production reconciliation", () => {
  it("writes deterministic Object Lock evidence without reading state bodies", async () => {
    const evidence = new Set<string>();
    const send = vi.fn(async (command: unknown) => {
      if (command instanceof ListObjectVersionsCommand) {
        if (command.input.Prefix === "v1/admins/")
          return {
            IsTruncated: false,
            Versions: [
              {
                ETag: '"admin-v2"',
                IsLatest: true,
                Key: "v1/admins/by-email/hash.json",
                LastModified: new Date("2026-08-06T01:00:00.000Z"),
                VersionId: "version-2",
              },
            ],
          };
        return { IsTruncated: false };
      }
      if (command instanceof PutObjectCommand) {
        const key = command.input.Key;
        if (!key) throw new Error("evidence key is required");
        if (evidence.has(key))
          throw Object.assign(new Error("exists"), {
            $metadata: { httpStatusCode: 412 },
            name: "PreconditionFailed",
          });
        evidence.add(key);
        expect(command.input).toMatchObject({
          Bucket: "beat-ledger",
          IfNoneMatch: "*",
          ObjectLockMode: "COMPLIANCE",
        });
        expect(String(command.input.Body)).not.toContain("passwordHash");
        return {};
      }
      throw new Error("unexpected command");
    });
    const client = { send } as unknown as S3Client;
    const reconciliation = await loadReconciliation();
    await expect(
      reconciliation.reconcileStateVersionAudit(client),
    ).resolves.toMatchObject({ checked: 1, newEvidence: 1 });
    await expect(
      reconciliation.reconcileStateVersionAudit(client),
    ).resolves.toMatchObject({ existingEvidence: 1, newEvidence: 0 });
    expect(
      send.mock.calls.some(
        ([command]) => command instanceof ListObjectVersionsCommand,
      ),
    ).toBe(true);
  });

  it("records durable-prefix delete markers for operator attention", async () => {
    const send = vi.fn(async (command: unknown) => {
      if (command instanceof ListObjectVersionsCommand) {
        if (command.input.Prefix === "v1/gourmet/")
          return {
            DeleteMarkers: [
              {
                IsLatest: true,
                Key: "v1/gourmet/entries/id/head.json",
                LastModified: new Date("2026-08-06T02:00:00.000Z"),
                VersionId: "deleted-version",
              },
            ],
            IsTruncated: false,
          };
        return { IsTruncated: false };
      }
      if (command instanceof PutObjectCommand) return {};
      throw new Error("unexpected command");
    });
    const reconciliation = await loadReconciliation();
    await expect(
      reconciliation.reconcileStateVersionAudit({
        send,
      } as unknown as S3Client),
    ).resolves.toMatchObject({
      checked: 1,
      unexpectedDeleteMarkers: 1,
    });
  });
});
