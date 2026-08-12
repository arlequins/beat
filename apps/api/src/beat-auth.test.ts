import { createHash, randomBytes, scrypt as scryptCallback } from "node:crypto";

import {
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { exportJWK, generateKeyPair, jwtVerify } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";

type StoredObject = { body: string; etag: string };

function s3Harness() {
  const objects = new Map<string, StoredObject>();
  const commands: unknown[] = [];
  let version = 0;
  const send = vi.fn(async (command: unknown) => {
    commands.push(command);
    if (command instanceof HeadBucketCommand) return {};
    const input = (
      command as {
        input: {
          Body?: string;
          Bucket: string;
          IfMatch?: string;
          IfNoneMatch?: string;
          Key: string;
        };
      }
    ).input;
    const objectKey = `${input.Bucket}/${input.Key}`;
    if (command instanceof GetObjectCommand) {
      const stored = objects.get(objectKey);
      if (!stored)
        throw Object.assign(new Error("missing"), {
          $metadata: { httpStatusCode: 404 },
          name: "NoSuchKey",
        });
      return {
        Body: { transformToString: async () => stored.body },
        ETag: stored.etag,
      };
    }
    if (command instanceof PutObjectCommand) {
      const current = objects.get(objectKey);
      if (
        (input.IfNoneMatch === "*" && current) ||
        (input.IfMatch && current?.etag !== input.IfMatch)
      )
        throw Object.assign(new Error("conflict"), {
          $metadata: { httpStatusCode: 412 },
          name: "PreconditionFailed",
        });
      version += 1;
      objects.set(objectKey, {
        body: String(input.Body),
        etag: `"v${version}"`,
      });
      return { ETag: `"v${version}"` };
    }
    throw new Error(`Unexpected command ${command?.constructor.name}`);
  });
  return {
    client: { send } as unknown as S3Client,
    commands,
    objects,
    send,
  };
}

async function loadAuth() {
  const { privateKey, publicKey } = await generateKeyPair("ES256", {
    extractable: true,
  });
  vi.stubEnv("BEAT_AUTH_STATE_BUCKET", "beat-auth-state");
  vi.stubEnv("BEAT_AUTH_LEDGER_BUCKET", "beat-auth-ledger");
  vi.stubEnv("BEAT_AUTH_STATE_PREFIX", "v1");
  vi.stubEnv(
    "BEAT_AUTH_LOOKUP_SECRET",
    "test-lookup-secret-that-is-at-least-32-characters",
  );
  vi.stubEnv("BEAT_AUTH_LEDGER_RETENTION_DAYS", "365");
  vi.stubEnv("BEAT_AUTH_REFRESH_TOKEN_TTL_SECONDS", "2592000");
  vi.stubEnv("BEAT_AUTH_ISSUER_URL", "https://api.example.com/auth");
  vi.stubEnv("BEAT_AUTH_AUDIENCE", "beat-agent");
  vi.stubEnv(
    "BEAT_AUTH_SIGNING_PRIVATE_JWK",
    JSON.stringify(await exportJWK(privateKey)),
  );
  vi.stubEnv("BEAT_AUTH_SIGNING_KEY_ID", "test-key");
  vi.resetModules();
  return {
    auth: await import("./beat-auth"),
    publicKey,
  };
}

async function legacyPasswordHash(password: string) {
  const salt = randomBytes(16);
  const value = await new Promise<Buffer>((resolve, reject) =>
    scryptCallback(password, salt, 64, (error, result) =>
      error ? reject(error) : resolve(result),
    ),
  );
  return `scrypt$${salt.toString("base64url")}$${value.toString("base64url")}`;
}

afterEach(() => {
  vi.doUnmock("@arlequins/env");
  vi.unstubAllEnvs();
});

describe("Beat S3 authentication", () => {
  it("creates a deterministic administrator state and rejects duplicates", async () => {
    const harness = s3Harness();
    const { auth } = await loadAuth();
    const created = await auth.createBeatAdmin(
      "ADMIN@example.com",
      "correct horse battery staple",
      harness.client,
    );

    expect(created.email).toBe("admin@example.com");
    await expect(
      auth.createBeatAdmin(
        "admin@example.com",
        "another sufficiently long password",
        harness.client,
      ),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(
      [...harness.objects.keys()].filter((key) =>
        key.includes("/admins/by-email/"),
      ),
    ).toHaveLength(1);
    const ledgerPut = harness.commands.find(
      (command) =>
        command instanceof PutObjectCommand &&
        command.input.Bucket === "beat-auth-ledger",
    ) as PutObjectCommand;
    expect(ledgerPut.input).toMatchObject({
      IfNoneMatch: "*",
      ObjectLockMode: "COMPLIANCE",
    });
  });

  it("authenticates state directly and supports legacy password hashes", async () => {
    const harness = s3Harness();
    const { auth } = await loadAuth();
    await auth.createBeatAdmin(
      "admin@example.com",
      "correct horse battery staple",
      harness.client,
    );
    await expect(
      auth.authenticateBeatAdmin(
        "ADMIN@example.com",
        "correct horse battery staple",
        harness.client,
      ),
    ).resolves.toMatchObject({ role: "admin" });
    await expect(
      auth.authenticateBeatAdmin(
        "admin@example.com",
        "wrong password",
        harness.client,
      ),
    ).resolves.toBeUndefined();

    const entry = [...harness.objects.entries()].find(([key]) =>
      key.includes("/admins/by-email/"),
    );
    expect(entry).toBeTruthy();
    const [key, stored] = entry!;
    const state = JSON.parse(stored.body) as {
      passwordHash: string;
      status: string;
    };
    state.passwordHash = await legacyPasswordHash("legacy password");
    harness.objects.set(key, {
      body: JSON.stringify(state),
      etag: '"legacy"',
    });
    await expect(
      auth.authenticateBeatAdmin(
        "admin@example.com",
        "legacy password",
        harness.client,
      ),
    ).resolves.toMatchObject({ role: "admin" });
    await auth.changeBeatAdminPassword(
      "admin@example.com",
      "new correct horse battery staple",
      harness.client,
    );
    await expect(
      auth.authenticateBeatAdmin(
        "admin@example.com",
        "legacy password",
        harness.client,
      ),
    ).resolves.toBeUndefined();
    await expect(
      auth.authenticateBeatAdmin(
        "admin@example.com",
        "new correct horse battery staple",
        harness.client,
      ),
    ).resolves.toMatchObject({ credentialVersion: 2 });
    await auth.disableBeatAdmin("admin@example.com", harness.client);
    await expect(
      auth.authenticateBeatAdmin(
        "admin@example.com",
        "new correct horse battery staple",
        harness.client,
      ),
    ).resolves.toBeUndefined();
  });

  it("issues and rotates access and refresh tokens", async () => {
    const harness = s3Harness();
    const { auth, publicKey } = await loadAuth();
    await auth.createBeatAdmin(
      "admin@example.com",
      "correct horse battery staple",
      harness.client,
    );
    const administrator = await auth.authenticateBeatAdmin(
      "admin@example.com",
      "correct horse battery staple",
      harness.client,
    );
    const first = await auth.issueBeatTokenPair(
      administrator!,
      "beat-agent",
      harness.client,
    );
    expect(first.refresh_token.split(".")).toHaveLength(3);
    await expect(
      jwtVerify(first.access_token, publicKey, {
        audience: "beat-agent",
        issuer: "https://api.example.com/auth",
      }),
    ).resolves.toMatchObject({
      payload: {
        credential_version: 1,
        role: "admin",
        sub: administrator?.subject,
      },
    });
    await expect(
      auth.verifyBeatAccessToken(first.access_token),
    ).resolves.toMatchObject({
      email: "admin@example.com",
      subject: administrator?.subject,
    });
    await expect(
      auth.verifyBeatAccessToken(`${first.access_token}invalid`),
    ).rejects.toThrow();

    const second = await auth.refreshBeatTokenPair(
      first.refresh_token,
      harness.client,
    );
    expect(second.refresh_token).not.toBe(first.refresh_token);
    expect(second.refresh_token.split(".")[1]).toBe("2");
    await expect(
      auth.refreshBeatTokenPair(first.refresh_token, harness.client),
    ).rejects.toMatchObject({ code: "invalid_refresh_token" });
    await expect(
      auth.refreshBeatTokenPair(second.refresh_token, harness.client),
    ).rejects.toMatchObject({ code: "invalid_refresh_token" });
  });

  it("revokes a refresh session idempotently", async () => {
    const harness = s3Harness();
    const { auth } = await loadAuth();
    await auth.createBeatAdmin(
      "admin@example.com",
      "correct horse battery staple",
      harness.client,
    );
    const administrator = await auth.authenticateBeatAdmin(
      "admin@example.com",
      "correct horse battery staple",
      harness.client,
    );
    const tokens = await auth.issueBeatTokenPair(
      administrator!,
      "beat-agent",
      harness.client,
    );
    await auth.revokeBeatRefreshToken(tokens.refresh_token, harness.client);
    await auth.revokeBeatRefreshToken("missing.1.invalid", harness.client);
    await expect(
      auth.refreshBeatTokenPair(tokens.refresh_token, harness.client),
    ).rejects.toMatchObject({ code: "invalid_refresh_token" });
  });

  it("redeems a one-time authorization code with S256 PKCE and a nonce ID token", async () => {
    const harness = s3Harness();
    const { auth, publicKey } = await loadAuth();
    await auth.createBeatAdmin(
      "admin@example.com",
      "correct horse battery staple",
      harness.client,
    );
    const administrator = await auth.authenticateBeatAdmin(
      "admin@example.com",
      "correct horse battery staple",
      harness.client,
    );
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const code = await auth.issueBeatAuthorizationCode(
      administrator!,
      {
        clientId: "beat-agent-web",
        codeChallenge: challenge,
        codeChallengeMethod: "S256",
        nonce: "nonce-from-agent",
        redirectUri: "https://agent.example.com/auth/callback/",
        scope: ["openid", "profile", "email"],
      },
      harness.client,
    );
    const tokens = await auth.redeemBeatAuthorizationCode(
      {
        clientId: "beat-agent-web",
        code,
        codeVerifier: verifier,
        redirectUri: "https://agent.example.com/auth/callback/",
      },
      harness.client,
    );
    expect(tokens.id_token).toBeTruthy();
    await expect(
      jwtVerify(tokens.id_token, publicKey, {
        audience: "beat-agent-web",
        issuer: "https://api.example.com/auth",
      }),
    ).resolves.toMatchObject({
      payload: { nonce: "nonce-from-agent", role: "admin" },
    });
    await expect(auth.verifyBeatIdTokenHint(tokens.id_token)).resolves.toEqual({
      clientId: "beat-agent-web",
      subject: administrator?.subject,
    });
    await expect(
      auth.redeemBeatAuthorizationCode(
        {
          clientId: "beat-agent-web",
          code,
          codeVerifier: verifier,
          redirectUri: "https://agent.example.com/auth/callback/",
        },
        harness.client,
      ),
    ).rejects.toMatchObject({ code: "invalid_authorization_code" });
  });

  it("publishes a private-key-free JWKS and checks both buckets", async () => {
    const harness = s3Harness();
    const { auth } = await loadAuth();
    await expect(auth.beatJwks()).resolves.toMatchObject({
      keys: [{ alg: "ES256", kid: "test-key", use: "sig" }],
    });
    expect((await auth.beatJwks()).keys[0]?.d).toBeUndefined();
    await auth.checkBeatStorageReadiness(harness.client);
    const headBuckets = harness.commands
      .filter((command) => command instanceof HeadBucketCommand)
      .map((command) => (command as HeadBucketCommand).input.Bucket);
    expect(headBuckets).toEqual(
      expect.arrayContaining(["beat-auth-state", "beat-auth-ledger"]),
    );
  });

  it("rejects malformed state objects instead of trusting S3 JSON", async () => {
    const harness = s3Harness();
    const { auth } = await loadAuth();
    await auth.createBeatAdmin(
      "admin@example.com",
      "correct horse battery staple",
      harness.client,
    );
    const entry = [...harness.objects.entries()].find(([key]) =>
      key.includes("/admins/by-email/"),
    );
    harness.objects.set(entry![0], {
      body: JSON.stringify({ schemaVersion: 99 }),
      etag: '"invalid"',
    });
    await expect(
      auth.authenticateBeatAdmin(
        "admin@example.com",
        "correct horse battery staple",
        harness.client,
      ),
    ).rejects.toThrow("Invalid administrator state");
  });
});
