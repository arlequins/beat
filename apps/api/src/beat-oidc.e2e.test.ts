import { describe, expect, it, vi } from "vitest";

import { createApiApp } from "./app";

describe("Beat OIDC HTTP flow (E2E)", () => {
  it("passes a browser authorization request through callback and token exchange", async () => {
    const issueAuthorizationCode = vi.fn(async () => "one-time-code");
    const redeemAuthorizationCode = vi.fn(async () => ({
      access_token: "access",
      expires_in: 600,
      id_token: "id-token",
      refresh_expires_in: 2_592_000,
      refresh_token: "session.1.secret",
      token_type: "Bearer" as const,
    }));
    const app = createApiApp({
      beatAuth: {
        authenticate: vi.fn(async () => ({
          adminKey: "v1/admin.json",
          credentialVersion: 1,
          email: "admin@example.com",
          passwordHash: "hidden",
          role: "admin" as const,
          subject: "admin-1",
        })),
        issueAuthorizationCode,
        issueTokenPair: vi.fn(),
        jwks: vi.fn(async () => ({ keys: [] })),
        redeemAuthorizationCode,
        refreshTokenPair: vi.fn(),
        revokeRefreshToken: vi.fn(),
        verifyAccessToken: vi.fn(),
      },
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
        child: () => ({
          error: vi.fn(),
          info: vi.fn(),
          warn: vi.fn(),
        }),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      } as never,
      rateLimiter: false,
    });
    const params = new URLSearchParams({
      client_id: "beat-agent-web",
      redirect_uri: "https://agent.example.com/auth/callback/",
      response_type: "code",
      scope: "openid profile email offline_access",
      state: "state",
      nonce: "nonce",
      code_challenge: "A".repeat(43),
      code_challenge_method: "S256",
    });
    const login = await app.request(`/auth/authorize?${params}`);
    expect(login.status).toBe(200);
    const callback = await app.request("/auth/authorize", {
      body: new URLSearchParams({
        ...Object.fromEntries(params),
        email: "admin@example.com",
        password: "password",
      }),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    });
    expect(callback.status).toBe(302);
    const callbackUrl = new URL(callback.headers.get("location")!);
    expect(callbackUrl.searchParams.get("code")).toBe("one-time-code");
    expect(callbackUrl.searchParams.get("state")).toBe("state");

    const token = await app.request("/auth/token", {
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: "beat-agent-web",
        code: "one-time-code",
        code_verifier: "verifier",
        redirect_uri: "https://agent.example.com/auth/callback/",
      }),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    });
    expect(token.status).toBe(200);
    await expect(token.json()).resolves.toMatchObject({
      access_token: "access",
      id_token: "id-token",
      refresh_token: "session.1.secret",
    });
    expect(issueAuthorizationCode).toHaveBeenCalledTimes(1);
    expect(redeemAuthorizationCode).toHaveBeenCalledTimes(1);
  });
});
