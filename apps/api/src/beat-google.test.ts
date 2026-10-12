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

async function loadGoogleWithClaims(payload: Record<string, unknown>) {
  const jwtVerify = vi.fn(async () => ({ payload }));
  vi.doMock("jose", () => ({
    createRemoteJWKSet: vi.fn(() => "jwks"),
    jwtVerify,
  }));
  const google = await loadGoogle();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ id_token: "id-token" })),
  );
  return { google, jwtVerify };
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
  it("preserves the separate private-fiction owner identity", async () => {
    const google = await loadGoogle();
    expect(google.GOOGLE_ALLOWED_EMAIL).toBe("tiret.rouge@gmail.com");
  });

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

  it.each(["tiret.rouge@gmail.com", "beat.lumen@gmail.com"])(
    "accepts %s with case and surrounding whitespace normalization only",
    async (email) => {
      const { google, jwtVerify } = await loadGoogleWithClaims({
        email: ` \t${email.toUpperCase()}\n`,
        email_verified: true,
        nonce: "nonce",
        sub: "google-subject",
      });
      await expect(
        google.exchangeGoogleAuthorizationCode("code", "nonce"),
      ).resolves.toEqual({ email, subject: "google-subject" });
      expect(jwtVerify).toHaveBeenCalledWith("id-token", "jwks", {
        algorithms: ["RS256"],
        audience: "google-client-id",
        issuer: ["https://accounts.google.com", "accounts.google.com"],
      });
    },
  );

  it.each([
    "someone-else@example.com",
    "tiret.rouge+test@gmail.com",
    "beat.lumen+test@gmail.com",
    "tiretrouge@gmail.com",
    "beatlumen@gmail.com",
    "tiret.rouge@googlemail.com",
    "beat.lumen@googlemail.com",
    "beat.lumen@gmail.com.example.com",
    "beat. lumen@gmail.com",
  ])("rejects non-allowlisted accounts and aliases: %s", async (email) => {
    const { google } = await loadGoogleWithClaims({
      email,
      email_verified: true,
      nonce: "nonce",
      sub: "google-subject",
    });
    await expect(
      google.exchangeGoogleAuthorizationCode("code", "nonce"),
    ).rejects.toThrow("Google account is not allowed for this Beat");
  });

  it.each(["tiret.rouge@gmail.com", "beat.lumen@gmail.com"])(
    "requires verified email, nonce, and subject claims for %s",
    async (email) => {
      const payload = {
        email,
        email_verified: true,
        nonce: "nonce",
        sub: "google-subject",
      };
      const { google, jwtVerify } = await loadGoogleWithClaims(payload);
      for (const invalidClaims of [
        { email_verified: false },
        { email_verified: "true" },
        { email_verified: undefined },
        { nonce: "different" },
        { nonce: undefined },
        { sub: undefined },
        { sub: 123 },
        { email: undefined },
        { email: 123 },
      ]) {
        jwtVerify.mockResolvedValueOnce({
          payload: { ...payload, ...invalidClaims },
        });
        await expect(
          google.exchangeGoogleAuthorizationCode("code", "nonce"),
        ).rejects.toThrow("Google identity verification failed");
      }
    },
  );

  it("rejects signed tokens with the wrong issuer or audience", async () => {
    const jose = await vi.importActual<typeof import("jose")>("jose");
    const { privateKey, publicKey } = await jose.generateKeyPair("RS256");
    vi.doMock("jose", () => ({
      ...jose,
      createRemoteJWKSet: vi.fn(() => publicKey),
    }));
    const google = await loadGoogle();
    for (const email of ["tiret.rouge@gmail.com", "beat.lumen@gmail.com"]) {
      for (const [issuer, audience, accepted] of [
        ["https://accounts.google.com", "google-client-id", true],
        ["accounts.google.com", "google-client-id", true],
        ["https://wrong-issuer.example.com", "google-client-id", false],
        ["https://accounts.google.com", "wrong-client-id", false],
      ] as const) {
        const idToken = await new jose.SignJWT({
          email,
          email_verified: true,
          nonce: "nonce",
        })
          .setProtectedHeader({ alg: "RS256" })
          .setSubject("google-subject")
          .setIssuer(issuer)
          .setAudience(audience)
          .setIssuedAt()
          .setExpirationTime("5m")
          .sign(privateKey);
        vi.stubGlobal(
          "fetch",
          vi.fn(async () => Response.json({ id_token: idToken })),
        );
        const exchange = google.exchangeGoogleAuthorizationCode(
          "code",
          "nonce",
        );
        if (accepted)
          await expect(exchange).resolves.toEqual({
            email,
            subject: "google-subject",
          });
        else
          await expect(exchange).rejects.toMatchObject({
            code: "ERR_JWT_CLAIM_VALIDATION_FAILED",
          });
      }
    }
  });
});
