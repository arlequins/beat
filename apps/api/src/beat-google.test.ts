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

afterEach(() => vi.unstubAllEnvs());

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
});
