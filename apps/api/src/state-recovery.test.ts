import {
  GetObjectCommand,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Beat state recovery", () => {
  it("copies a selected version into a non-live recovery prefix", async () => {
    vi.stubEnv("BEAT_AUTH_STATE_BUCKET", "beat-state");
    vi.stubEnv("BEAT_AUTH_STATE_PREFIX", "v1");
    vi.resetModules();
    const send = vi.fn(async (command: unknown) => {
      if (command instanceof GetObjectCommand) {
        expect(command.input).toMatchObject({
          Key: "v1/drafts/post/head.json",
          VersionId: "version-1",
        });
        return {
          Body: {
            transformToByteArray: async () =>
              new TextEncoder().encode('{"schemaVersion":1}'),
          },
          ContentType: "application/json",
        };
      }
      if (command instanceof PutObjectCommand) {
        expect(command.input).toMatchObject({
          Bucket: "beat-state",
          IfNoneMatch: "*",
          Key: "v1/recovery/2026-08-06T00-00-00.000Z/drafts/post/head.json",
        });
        return {};
      }
      throw new Error("unexpected command");
    });
    const { recoverBeatStateVersion } = await import("./state-recovery");
    await expect(
      recoverBeatStateVersion(
        {
          sourceKey: "v1/drafts/post/head.json",
          versionId: "version-1",
        },
        { send } as unknown as S3Client,
        new Date("2026-08-06T00:00:00.000Z"),
      ),
    ).resolves.toMatchObject({
      destinationKey:
        "v1/recovery/2026-08-06T00-00-00.000Z/drafts/post/head.json",
    });
  });

  it("rejects traversal and recovery-of-recovery sources", async () => {
    vi.stubEnv("BEAT_AUTH_STATE_BUCKET", "beat-state");
    vi.stubEnv("BEAT_AUTH_STATE_PREFIX", "v1");
    vi.resetModules();
    const { recoverBeatStateVersion } = await import("./state-recovery");
    const client = { send: vi.fn() } as unknown as S3Client;
    await expect(
      recoverBeatStateVersion(
        { sourceKey: "../secret", versionId: "one" },
        client,
      ),
    ).rejects.toThrow("non-recovery Beat state key");
    await expect(
      recoverBeatStateVersion(
        { sourceKey: "v1/recovery/old.json", versionId: "one" },
        client,
      ),
    ).rejects.toThrow("non-recovery Beat state key");
    expect(client.send).not.toHaveBeenCalled();
  });
});
