import {
  GetObjectCommand,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

import { createS3RateLimitAdapter } from "./s3-rate-limit";

function harness(conflicts = 0) {
  let stored: { body: string; etag: string } | undefined;
  let version = 0;
  let remainingConflicts = conflicts;
  const send = vi.fn(async (command: unknown) => {
    if (command instanceof GetObjectCommand) {
      if (!stored)
        throw Object.assign(new Error("missing"), {
          $metadata: { httpStatusCode: 404 },
          name: "NoSuchKey",
        });
      return {
        Body: { transformToString: async () => stored?.body ?? "" },
        ETag: stored.etag,
      };
    }
    if (command instanceof PutObjectCommand) {
      if (remainingConflicts > 0) {
        remainingConflicts -= 1;
        throw Object.assign(new Error("conflict"), {
          $metadata: { httpStatusCode: 412 },
          name: "PreconditionFailed",
        });
      }
      version += 1;
      stored = {
        body: String(command.input.Body),
        etag: `"v${version}"`,
      };
      return {};
    }
    throw new Error("unexpected command");
  });
  return {
    client: { send } as unknown as S3Client,
    send,
    setStored(body: string) {
      stored = { body, etag: '"seed"' };
    },
  };
}

describe("S3 rate limiter", () => {
  it("persists a fixed window and rejects requests above the limit", async () => {
    const { client, send } = harness();
    const limiter = createS3RateLimitAdapter({
      bucket: "state",
      client,
      lookupSecret: "test-secret",
      prefix: "v1",
    });
    const input = {
      key: "203.0.113.10",
      limit: 1,
      now: new Date("2026-07-30T00:00:10.000Z"),
      windowMs: 60_000,
    };
    await expect(limiter.consume(input)).resolves.toMatchObject({
      allowed: true,
      remaining: 0,
    });
    await expect(limiter.consume(input)).resolves.toMatchObject({
      allowed: false,
      remaining: 0,
    });
    const put = send.mock.calls
      .map(([command]) => command)
      .find((command) => command instanceof PutObjectCommand);
    expect(put).toBeInstanceOf(PutObjectCommand);
    expect(put!.input).toMatchObject({ IfNoneMatch: "*" });
    expect(put!.input.Key).not.toContain(input.key);
  });

  it("retries a conditional-write conflict", async () => {
    const { client } = harness(1);
    const limiter = createS3RateLimitAdapter({
      bucket: "state",
      client,
      lookupSecret: "test-secret",
      retries: 2,
    });
    await expect(
      limiter.consume({
        key: "identity",
        limit: 2,
        now: new Date("2026-07-30T00:00:10.000Z"),
        windowMs: 60_000,
      }),
    ).resolves.toMatchObject({ allowed: true });
  });

  it("fails closed on persistent contention or malformed state", async () => {
    const contended = harness(2);
    const limiter = createS3RateLimitAdapter({
      bucket: "state",
      client: contended.client,
      lookupSecret: "test-secret",
      retries: 1,
    });
    const input = {
      key: "identity",
      limit: 2,
      now: new Date("2026-07-30T00:00:10.000Z"),
      windowMs: 60_000,
    };
    await expect(limiter.consume(input)).rejects.toThrow(
      "S3 rate-limit state remained contended",
    );

    const malformed = harness();
    malformed.setStored('{"schemaVersion":99}');
    const malformedLimiter = createS3RateLimitAdapter({
      bucket: "state",
      client: malformed.client,
      lookupSecret: "test-secret",
    });
    await expect(malformedLimiter.consume(input)).rejects.toThrow(
      "Invalid S3 rate-limit state",
    );
  });
});
