import {
  GetBucketLifecycleConfigurationCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("production S3 qualification", () => {
  it("requires explicit production acknowledgement", async () => {
    vi.stubEnv("BEAT_AUTH_STATE_BUCKET", "state");
    vi.stubEnv("BEAT_AUTH_LEDGER_BUCKET", "ledger");
    vi.resetModules();
    const { qualifyBeatProductionStorage } = await import(
      "./production-qualification"
    );
    const client = { send: vi.fn() } as unknown as S3Client;
    await expect(qualifyBeatProductionStorage(client)).rejects.toThrow(
      "BEAT_PRODUCTION_QUALIFICATION_CONFIRM=production",
    );
    expect(client.send).not.toHaveBeenCalled();
  });

  it("verifies conditional writes, versioning, lifecycle, and Object Lock", async () => {
    vi.stubEnv("BEAT_AUTH_STATE_BUCKET", "state");
    vi.stubEnv("BEAT_AUTH_LEDGER_BUCKET", "ledger");
    vi.stubEnv("BEAT_AUTH_STATE_PREFIX", "v1");
    vi.stubEnv("BEAT_PRODUCTION_QUALIFICATION_CONFIRM", "production");
    vi.resetModules();
    let conditionalWrites = 0;
    const send = vi.fn(async (command: unknown) => {
      if (command instanceof HeadBucketCommand) return {};
      if (command instanceof PutObjectCommand) {
        if (command.input.Bucket === "state" && command.input.IfMatch) {
          conditionalWrites += 1;
          if (conditionalWrites === 2)
            throw Object.assign(new Error("conflict"), {
              $metadata: { httpStatusCode: 412 },
              name: "PreconditionFailed",
            });
        }
        return command.input.Bucket === "ledger"
          ? { VersionId: "ledger-version" }
          : {};
      }
      if (command instanceof HeadObjectCommand) {
        if (command.input.Bucket === "state")
          return { ETag: '"state-etag"', VersionId: "state-version" };
        return {
          ObjectLockMode: "COMPLIANCE",
          ObjectLockRetainUntilDate: new Date("2026-08-07T00:00:00.000Z"),
        };
      }
      if (command instanceof GetBucketLifecycleConfigurationCommand)
        return { Rules: [{ ID: "expire-refresh-sessions" }] };
      throw new Error("unexpected command");
    });
    const { qualifyBeatProductionStorage } = await import(
      "./production-qualification"
    );
    await expect(
      qualifyBeatProductionStorage(
        { send } as unknown as S3Client,
        new Date("2026-08-06T00:00:00.000Z"),
      ),
    ).resolves.toMatchObject({
      conditionalWrite: "one-winner-one-conflict",
      lifecycleRuleIds: ["expire-refresh-sessions"],
      stateVersioning: "enabled",
    });
  });

  it("keeps the protected production qualification read-only", async () => {
    vi.stubEnv("BEAT_AUTH_STATE_BUCKET", "state");
    vi.stubEnv("BEAT_AUTH_LEDGER_BUCKET", "ledger");
    vi.stubEnv("BEAT_AUTH_STATE_PREFIX", "v1");
    vi.stubEnv("BEAT_PRODUCTION_QUALIFICATION_CONFIRM", "production");
    vi.stubEnv("BEAT_PRODUCTION_QUALIFICATION_MODE", "read-only");
    vi.resetModules();
    const send = vi.fn(async (command: unknown) => {
      const name = (command as { constructor?: { name?: string } }).constructor
        ?.name;
      if (name === "HeadBucketCommand") return {};
      if (name === "GetBucketLifecycleConfigurationCommand")
        return { Rules: [{ ID: "expire-refresh-sessions" }] };
      if (name === "GetBucketVersioningCommand") return { Status: "Enabled" };
      if (name === "GetObjectLockConfigurationCommand")
        return { ObjectLockConfiguration: { ObjectLockEnabled: "Enabled" } };
      throw new Error(`unexpected command ${name}`);
    });
    const { qualifyBeatProductionStorage } = await import(
      "./production-qualification"
    );
    await expect(
      qualifyBeatProductionStorage({ send } as unknown as S3Client),
    ).resolves.toMatchObject({
      conditionalWrite: "not-run",
      lifecycleRuleIds: ["expire-refresh-sessions"],
      mode: "read-only",
      stateKey: null,
      stateVersioning: "enabled",
    });
    expect(
      send.mock.calls.some(
        ([command]) =>
          (command as { constructor?: { name?: string } }).constructor?.name ===
          "PutObjectCommand",
      ),
    ).toBe(false);
  });
});
