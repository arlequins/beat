import { describe, expect, it, vi } from "vitest";

describe("Beat Google SSO authorization bridge", () => {
  it("redirects the Agent OIDC request to Google when configured", async () => {
    vi.stubEnv("BEAT_AUTH_GOOGLE_CLIENT_ID", "google-client-id");
    vi.stubEnv("BEAT_AUTH_GOOGLE_CLIENT_SECRET", "google-client-secret");
    vi.stubEnv(
      "BEAT_AUTH_GOOGLE_REDIRECT_URI",
      "https://api.example.com/auth/google/callback",
    );
    vi.stubEnv(
      "BEAT_AUTH_LOOKUP_SECRET",
      "test-lookup-secret-that-is-at-least-32-characters",
    );
    vi.stubEnv("BEAT_AUTH_ISSUER_URL", "https://api.example.com/auth");
    vi.resetModules();
    const { createApiApp } = await import("./app");
    const app = createApiApp({
      beatOidcClientsJson: JSON.stringify([
        {
          client_id: "beat-agent-web",
          redirect_uris: ["https://agent.example.com/auth/callback/"],
          post_logout_redirect_uris: [
            "https://agent.example.com/auth/logout-callback/",
          ],
          scopes: ["openid", "profile", "email", "offline_access"],
        },
      ]),
      corsOrigins: ["https://agent.example.com"],
      logger: {
        child: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      } as never,
      rateLimiter: false,
    });
    const params = new URLSearchParams({
      client_id: "beat-agent-web",
      code_challenge: "A".repeat(43),
      code_challenge_method: "S256",
      nonce: "nonce",
      redirect_uri: "https://agent.example.com/auth/callback/",
      response_type: "code",
      scope: "openid profile email offline_access",
      state: "state",
    });
    const response = await app.request(`/auth/authorize?${params}`);
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location")!);
    expect(location.origin).toBe("https://accounts.google.com");
    expect(location.searchParams.get("redirect_uri")).toBe(
      "https://api.example.com/auth/google/callback",
    );
    vi.unstubAllEnvs();
  });
});
