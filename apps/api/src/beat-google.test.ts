import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const request = {
  clientId: "beat-agent-web",
  codeChallenge: "A".repeat(43),
  codeChallengeMethod: "S256" as const,
  nonce: "agent-nonce",
  redirectUri: "https://agent.example.com/auth/callback/",
  scope: ["openid", "profile", "email"],
  state: "agent-state",
};

afterEach(() => {
  vi.doUnmock("jose");
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function loadGoogle() {
  vi.stubEnv("BEAT_AUTH_ISSUER_URL", "https://api.example.com/auth");
  vi.stubEnv(
    "BEAT_AUTH_LOOKUP_SECRET",
    "test-lookup-secret-that-is-at-least-32-characters",
  );
  vi.stubEnv("BEAT_AUTH_GOOGLE_CLIENT_ID", "google-client-id");
  vi.stubEnv("BEAT_AUTH_GOOGLE_CLIENT_SECRET", "google-client-secret");
  vi.stubEnv(
    "BEAT_AUTH_GOOGLE_REDIRECT_URI",
    "https://api.example.com/auth/google/callback",
  );
  vi.resetModules();
  return import("./beat-google");
}

function signedState(payload: unknown) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac(
    "sha256",
    "test-lookup-secret-that-is-at-least-32-characters",
  )
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

describe("Beat Google SSO", () => {
  it("creates a signed Google authorization URL and round-trips its state", async () => {
    const google = await loadGoogle();
    const authorizationUrl = new URL(
      google.createGoogleAuthorizationUrl(request),
    );
    expect(authorizationUrl.origin).toBe("https://accounts.google.com");
    expect(authorizationUrl.pathname).toBe("/o/oauth2/v2/auth");
    expect(authorizationUrl.searchParams.get("client_id")).toBe(
      "google-client-id",
    );
    expect(authorizationUrl.searchParams.get("scope")).toBe(
      "openid email profile",
    );
    const state = google.verifyGoogleAuthorizationState(
      authorizationUrl.searchParams.get("state")!,
    );
    expect(state.request).toMatchObject(request);
    expect(state.nonce).toBe(authorizationUrl.searchParams.get("nonce"));
  });

  it("rejects a tampered or expired state before contacting Google", async () => {
    const google = await loadGoogle();
    const authorizationUrl = new URL(
      google.createGoogleAuthorizationUrl(request),
    );
    const state = authorizationUrl.searchParams.get("state")!;
    expect(() =>
      google.verifyGoogleAuthorizationState(`${state}tampered`),
    ).toThrow("Invalid Google authorization state");
  });

  it("rejects malformed, unsigned, and invalidly shaped state values", async () => {
    const google = await loadGoogle();
    expect(() =>
      google.verifyGoogleAuthorizationState("missing-signature"),
    ).toThrow("Invalid Google authorization state");
    expect(() => google.verifyGoogleAuthorizationState("a.b.c")).toThrow(
      "Invalid Google authorization state",
    );
    const invalidJson = `${Buffer.from("not-json").toString("base64url")}.${createHmac(
      "sha256",
      "test-lookup-secret-that-is-at-least-32-characters",
    )
      .update(Buffer.from("not-json").toString("base64url"))
      .digest("base64url")}`;
    expect(() => google.verifyGoogleAuthorizationState(invalidJson)).toThrow(
      "Invalid Google authorization state",
    );
    expect(() =>
      google.verifyGoogleAuthorizationState(signedState(null)),
    ).toThrow("Invalid Google authorization state");
    const now = Math.floor(Date.now() / 1_000);
    expect(() =>
      google.verifyGoogleAuthorizationState(
        signedState({
          exp: now - 1,
          iat: now,
          nonce: "nonce",
          request,
          version: 1,
        }),
      ),
    ).toThrow("Expired Google authorization state");
    expect(() =>
      google.verifyGoogleAuthorizationState(
        signedState({
          exp: now + 600,
          iat: now + 31,
          nonce: "nonce",
          request,
          version: 1,
        }),
      ),
    ).toThrow("Expired Google authorization state");
  });

  it("uses the issuer-derived callback and reports configuration state", async () => {
    const google = await loadGoogle();
    expect(google.isGoogleSsoConfigured()).toBe(true);
    expect(google.googleRedirectUri()).toBe(
      "https://api.example.com/auth/google/callback",
    );

    vi.unstubAllEnvs();
    vi.stubEnv("BEAT_AUTH_ISSUER_URL", "https://api.example.com/auth/");
    vi.stubEnv(
      "BEAT_AUTH_LOOKUP_SECRET",
      "test-lookup-secret-that-is-at-least-32-characters",
    );
    vi.stubEnv("BEAT_AUTH_GOOGLE_CLIENT_ID", "google-client-id");
    vi.stubEnv("BEAT_AUTH_GOOGLE_CLIENT_SECRET", "google-client-secret");
    vi.resetModules();
    const defaultConfig = await import("./beat-google");
    expect(defaultConfig.googleRedirectUri()).toBe(
      "https://api.example.com/auth/google/callback",
    );

    vi.unstubAllEnvs();
    vi.stubEnv("BEAT_AUTH_GOOGLE_CLIENT_ID", "google-client-id");
    vi.resetModules();
    const incompleteConfig = await import("./beat-google");
    expect(incompleteConfig.isGoogleSsoConfigured()).toBe(false);
    expect(() => incompleteConfig.googleRedirectUri()).toThrow(
      "BEAT_AUTH_GOOGLE_CLIENT_SECRET is required for Google SSO",
    );
  });

  it("handles failed Google authorization-code responses without exposing tokens", async () => {
    const google = await loadGoogle();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("provider unavailable", { status: 503 })),
    );
    await expect(
      google.exchangeGoogleAuthorizationCode("code", "nonce"),
    ).rejects.toThrow("Google authorization code exchange failed");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ access_token: "not-an-id-token" })),
    );
    await expect(
      google.exchangeGoogleAuthorizationCode("code", "nonce"),
    ).rejects.toThrow("Google token response did not include an ID token");
  });

  it("verifies Google token claims and enforces the exact account allowlist", async () => {
    let payload: Record<string, unknown> = {
      email: "TIRET.ROUGE@gmail.com",
      email_verified: true,
      nonce: "nonce",
      sub: "google-subject",
    };
    vi.doMock("jose", () => ({
      createRemoteJWKSet: vi.fn(() => "jwks"),
      jwtVerify: vi.fn(async () => ({ payload })),
    }));
    const google = await loadGoogle();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ id_token: "id-token" })),
    );
    await expect(
      google.exchangeGoogleAuthorizationCode("code", "nonce"),
    ).resolves.toEqual({
      email: "tiret.rouge@gmail.com",
      subject: "google-subject",
    });

    payload = { ...payload, email: "someone-else@example.com" };
    await expect(
      google.exchangeGoogleAuthorizationCode("code", "nonce"),
    ).rejects.toThrow("Google account is not allowed for this Beat");
    payload = {
      ...payload,
      email: "tiret.rouge@gmail.com",
      email_verified: false,
    };
    await expect(
      google.exchangeGoogleAuthorizationCode("code", "nonce"),
    ).rejects.toThrow("Google identity verification failed");
    payload = { ...payload, email_verified: true, nonce: "different" };
    await expect(
      google.exchangeGoogleAuthorizationCode("code", "nonce"),
    ).rejects.toThrow("Google identity verification failed");
    payload = {
      email: "tiret.rouge@gmail.com",
      email_verified: true,
      nonce: "nonce",
    };
    await expect(
      google.exchangeGoogleAuthorizationCode("code", "nonce"),
    ).rejects.toThrow("Google identity verification failed");
  });
});
