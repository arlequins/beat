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
      resource_parameter_supported: true,
      scopes_supported: expect.arrayContaining([
        "offline_access",
        "gourmet:read",
        "gourmet:write",
      ]),
      token_endpoint: "https://api.example.com/auth/token",
    });
  });

  it("advertises CIMD only when an exact ChatGPT client URL is allowlisted", async () => {
    vi.stubEnv(
      "BEAT_AUTH_CLIENTS_JSON",
      JSON.stringify([
        {
          client_id: "https://chatgpt.com/oauth/example/client.json",
          redirect_uris: ["https://chatgpt.com/connector/oauth/example"],
          post_logout_redirect_uris: [
            "https://chatgpt.com/connector/oauth/example",
          ],
          resources: ["https://api.example.com/mcp"],
          scopes: ["openid", "gourmet:read", "gourmet:write"],
        },
      ]),
    );
    vi.stubEnv("BEAT_AUTH_ISSUER_URL", "https://api.example.com/auth");
    vi.resetModules();
    const { createApiApp } = await import("./app");
    const app = createApiApp({
      corsOrigins: ["https://chatgpt.com"],
      logger: (await import("@arlequins/logger")).createLogger({
        service: "api",
        sink: () => {},
      }),
      rateLimiter: false,
    });
    const response = await app.request(
      "/auth/.well-known/openid-configuration",
    );
    await expect(response.json()).resolves.toMatchObject({
      client_id_metadata_document_supported: true,
    });
  });
});
