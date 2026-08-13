import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function createConfiguredApp() {
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
  return createApiApp({
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
}

function authorizationParams() {
  return new URLSearchParams({
    client_id: "beat-agent-web",
    code_challenge: "A".repeat(43),
    code_challenge_method: "S256",
    nonce: "nonce",
    redirect_uri: "https://agent.example.com/auth/callback/",
    response_type: "code",
    scope: "openid profile email offline_access",
    state: "state",
  });
}

describe("Beat Google SSO authorization bridge", () => {
  it("redirects the Agent OIDC request to Google when configured", async () => {
    const app = await createConfiguredApp();
    const params = authorizationParams();
    const response = await app.request(`/auth/authorize?${params}`);
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location")!);
    expect(location.origin).toBe("https://accounts.google.com");
    expect(location.searchParams.get("redirect_uri")).toBe(
      "https://api.example.com/auth/google/callback",
    );
  });

  it("returns the Agent callback error for missing, invalid, and denied Google callbacks", async () => {
    const app = await createConfiguredApp();
    expect((await app.request("/auth/google/callback")).status).toBe(400);
    expect(
      (await app.request("/auth/google/callback?state=invalid")).status,
    ).toBe(400);

    const login = await app.request(`/auth/authorize?${authorizationParams()}`);
    const googleState = new URL(
      login.headers.get("location")!,
    ).searchParams.get("state");
    expect(googleState).toBeTruthy();
    const denied = await app.request(
      `/auth/google/callback?${new URLSearchParams({
        error: "access_denied",
        state: googleState!,
      })}`,
    );
    expect(denied.status).toBe(302);
    const deniedLocation = new URL(denied.headers.get("location")!);
    expect(deniedLocation.searchParams.get("error")).toBe("access_denied");

    const missingCode = await app.request(
      `/auth/google/callback?${new URLSearchParams({ state: googleState! })}`,
    );
    expect(missingCode.status).toBe(302);
    expect(
      new URL(missingCode.headers.get("location")!).searchParams.get("error"),
    ).toBe("access_denied");
  });
});
