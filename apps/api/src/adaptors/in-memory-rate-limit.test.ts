import { describe, expect, it } from "vitest";
import { createInMemoryRateLimitAdapter } from "./in-memory-rate-limit";

describe("createInMemoryRateLimitAdapter", () => {
  it("resets fixed windows without exposing HTTP concerns", async () => {
    const limiter = createInMemoryRateLimitAdapter();
    const input = {
      key: "client-1",
      limit: 1,
      now: new Date(0),
      windowMs: 1_000,
    };
    await expect(limiter.consume(input)).resolves.toMatchObject({
      allowed: true,
      remaining: 0,
    });
    await expect(limiter.consume(input)).resolves.toMatchObject({
      allowed: false,
      remaining: 0,
    });
    await expect(
      limiter.consume({ ...input, now: new Date(1_000) }),
    ).resolves.toMatchObject({ allowed: true, remaining: 0 });
  });

  it("evicts expired entries when its bounded store is full", async () => {
    const limiter = createInMemoryRateLimitAdapter({ maxEntries: 1 });
    await limiter.consume({
      key: "expired",
      limit: 1,
      now: new Date(0),
      windowMs: 1,
    });
    await expect(
      limiter.consume({ key: "next", limit: 1, now: new Date(2), windowMs: 1 }),
    ).resolves.toMatchObject({ allowed: true });
  });
});
