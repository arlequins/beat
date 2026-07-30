import { randomBytes, scrypt as scryptCallback } from "node:crypto";

import { exportJWK, generateKeyPair, jwtVerify } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";

async function passwordHash(password: string) {
  const salt = randomBytes(16);
  const value = await new Promise<Buffer>((resolve, reject) =>
    scryptCallback(password, salt, 64, (error, result) =>
      error ? reject(error) : resolve(result),
    ),
  );
  return `scrypt$${salt.toString("base64url")}$${value.toString("base64url")}`;
}

afterEach(() => vi.unstubAllEnvs());

describe("Beat S3 authentication", () => {
  it("projects immutable events, rejects disabled credentials, and signs access tokens", async () => {
    const { privateKey, publicKey } = await generateKeyPair("ES256", {
      extractable: true,
    });
    const privateJwk = await exportJWK(privateKey);
    const hash = await passwordHash("correct horse battery staple");
    const events = [
      {
        at: "2026-07-01T00:00:00.000Z",
        email: "admin@example.com",
        passwordHash: hash,
        subject: "admin-1",
        type: "admin-created",
      },
      {
        at: "2026-07-02T00:00:00.000Z",
        email: "off@example.com",
        passwordHash: hash,
        subject: "admin-2",
        type: "admin-created",
      },
      {
        at: "2026-07-03T00:00:00.000Z",
        email: "off@example.com",
        subject: "admin-2",
        type: "admin-disabled",
      },
    ];
    const send = vi.fn(async (command: { input: { Key?: string } }) => {
      if (!command.input.Key)
        return {
          Contents: events.map((_, index) => ({
            Key: `admins/events/${index}`,
          })),
        };
      const event = events[Number(command.input.Key.at(-1))];
      return { Body: { transformToString: async () => JSON.stringify(event) } };
    });
    vi.stubEnv("BEAT_AUTH_EVENTS_BUCKET", "beat-auth-events");
    vi.stubEnv("BEAT_AUTH_EVENTS_PREFIX", "admins/events");
    vi.stubEnv("BEAT_AUTH_ISSUER_URL", "https://api.example.com/auth");
    vi.stubEnv("BEAT_AUTH_AUDIENCE", "beat-agent");
    vi.stubEnv("BEAT_AUTH_SIGNING_PRIVATE_JWK", JSON.stringify(privateJwk));
    vi.stubEnv("BEAT_AUTH_SIGNING_KEY_ID", "test-key");
    vi.resetModules();
    vi.doMock("@aws-sdk/client-s3", () => ({
      GetObjectCommand: class {
        constructor(readonly input: { Key: string }) {}
      },
      ListObjectsV2Command: class {
        constructor(readonly input: Record<string, unknown>) {}
      },
      S3Client: class {
        send = send;
      },
    }));
    const auth = await import("./beat-auth");
    const administrator = await auth.authenticateBeatAdmin(
      "ADMIN@example.com",
      "correct horse battery staple",
    );
    expect(administrator?.subject).toBe("admin-1");
    await expect(
      auth.authenticateBeatAdmin("admin@example.com", "wrong password"),
    ).resolves.toBeUndefined();
    await expect(
      auth.authenticateBeatAdmin(
        "off@example.com",
        "correct horse battery staple",
      ),
    ).resolves.toBeUndefined();
    const token = await auth.issueBeatAccessToken(administrator!);
    await expect(
      jwtVerify(token, publicKey, {
        audience: "beat-agent",
        issuer: "https://api.example.com/auth",
      }),
    ).resolves.toMatchObject({ payload: { role: "admin", sub: "admin-1" } });
    await expect(auth.beatJwks()).resolves.toMatchObject({
      keys: [{ kid: "test-key" }],
    });
  });
});
