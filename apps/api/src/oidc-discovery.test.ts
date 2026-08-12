import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllEnvs());

describe("Beat OIDC discovery", () => {
  it("publishes the Agent authorization, token, revoke, and logout endpoints", async () => {
    vi.stubEnv("BEAT_AUTH_ISSUER_URL", "https://api.example.com/auth");
    vi.resetModules();
    const { createApiApp } = await import("./app");
    const app = createApiApp({
      corsOrigins: ["https://agent.example.com"],
      logger: (await import("@arlequins/logger")).createLogger({
        service: "api",
        sink: () => {},
      }),
      rateLimiter: false,
    });
    const response = await app.request(
      "/auth/.well-known/openid-configuration",
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      authorization_endpoint: "https://api.example.com/auth/authorize",
      code_challenge_methods_supported: ["S256"],
      end_session_endpoint: "https://api.example.com/auth/logout",
      grant_types_supported: ["authorization_code", "refresh_token"],
      response_types_supported: ["code"],
      scopes_supported: expect.arrayContaining(["offline_access"]),
      token_endpoint: "https://api.example.com/auth/token",
    });
  });
});
