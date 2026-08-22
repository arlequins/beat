import type { LogRecord } from "@arlequins/logger";
import { createLogger } from "@arlequins/logger";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiApp } from "./app";
import { GourmetError } from "./gourmet";

afterEach(() => vi.unstubAllEnvs());

const oidcClientsJson = JSON.stringify([
  {
    client_id: "beat-agent-web",
    redirect_uris: ["https://agent.example.com/auth/callback/"],
    post_logout_redirect_uris: [
      "https://agent.example.com/auth/logout-callback/",
    ],
    scopes: ["openid", "profile", "email", "offline_access"],
  },
]);

describe("API app", () => {
  const app = createApiApp({
    corsOrigins: ["http://localhost:3000"],
    logger: createLogger({ service: "api", sink: () => {} }),
  });

  it("reports process liveness without checking dependencies", async () => {
    const response = await app.request("/health/live");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      checks: { process: "ok" },
      status: "ok",
    });
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });

  it("allows preflight requests only from configured browser origins", async () => {
    const allowed = await app.request("/api/echo", {
      headers: {
        "Access-Control-Request-Headers":
          "authorization,content-type,x-client-request-id",
        "Access-Control-Request-Method": "POST",
        Origin: "http://localhost:3000",
      },
      method: "OPTIONS",
    });
    const rejected = await app.request("/api/echo", {
      headers: {
        "Access-Control-Request-Method": "POST",
        Origin: "https://untrusted.example",
      },
      method: "OPTIONS",
    });

    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3000",
    );
    expect(allowed.headers.get("access-control-allow-methods")).toContain(
      "POST",
    );
    expect(rejected.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("normalizes duplicate CORS origins before emitting headers", async () => {
    const duplicateOriginApp = createApiApp({
      corsOrigins: ["http://localhost:3000/", "http://localhost:3000"],
      logger: createLogger({ service: "api", sink: () => {} }),
    });
    const response = await duplicateOriginApp.request("/health/live", {
      headers: { Origin: "http://localhost:3000" },
    });

    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3000",
    );
  });

  it("reports readiness when required dependencies are available", async () => {
    const readyApp = createApiApp({
      corsOrigins: ["http://localhost:3000"],
      logger: createLogger({ service: "api", sink: () => {} }),
      readinessCheck: async () => {},
    });

    const response = await readyApp.request("/health/ready");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      checks: { storage: "ok" },
      status: "ok",
    });
  });

  it("reports unavailable when a required dependency fails", async () => {
    const records: LogRecord[] = [];
    const unavailableApp = createApiApp({
      corsOrigins: ["http://localhost:3000"],
      logger: createLogger({
        service: "api",
        sink: (record) => records.push(record),
      }),
      readinessCheck: async () => {
        throw new Error("database unavailable");
      },
    });

    const response = await unavailableApp.request("/health/ready");

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      checks: { storage: "unavailable" },
      status: "unavailable",
    });
    expect(records).toContainEqual(
      expect.objectContaining({ message: "health.readiness.failed" }),
    );
  });

  it("returns a structured not-found response", async () => {
    const response = await app.request("/missing");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: "Not Found",
    });
  });

  it("hosts an executable OpenAPI document", async () => {
    const response = await app.request("/openapi.json");
    const document = (await response.json()) as {
      openapi: string;
      paths: Record<string, Record<string, unknown>>;
    };

    expect(response.status).toBe(200);
    expect(document.openapi).toBe("3.1.0");
    expect(document.paths["/health/live"]?.get).toBeTruthy();
    expect(document.paths["/health/ready"]?.get).toBeTruthy();
    expect(document.paths["/api/echo"]?.post).toBeTruthy();
  });

  it("hosts the API explorer against the local OpenAPI document", async () => {
    const response = await app.request("/docs");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain("Application API Explorer");
    expect(html).toContain("/openapi.json");
  });

  it("executes a documented JSON request", async () => {
    const response = await app.request("/api/echo", {
      body: JSON.stringify({ message: "Hello from the test client" }),
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": "echo-request-1",
      },
      method: "POST",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      message: "Hello from the test client",
      requestId: "echo-request-1",
    });
  });

  it("rejects requests that do not match the OpenAPI contract", async () => {
    const response = await app.request("/api/echo", {
      body: JSON.stringify({ message: "" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid Request",
      requestId: expect.any(String),
    });
  });

  it("propagates the request ID into HTTP logs", async () => {
    const records: LogRecord[] = [];
    const loggedApp = createApiApp({
      corsOrigins: ["http://localhost:3000"],
      logger: createLogger({
        service: "api",
        sink: (record) => records.push(record),
      }),
    });

    await loggedApp.request("/missing", {
      headers: { "X-Request-Id": "request-123" },
    });

    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: "http.request.completed",
          requestId: "request-123",
        }),
      ]),
    );
  });

  it("allows configured browser origins", async () => {
    const response = await app.request("/auth/login", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,content-type",
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3000",
    );
    expect(response.headers.get("access-control-allow-headers")).toContain(
      "Content-Type",
    );
    expect(response.headers.get("access-control-allow-headers")).toContain(
      "X-Client-Request-Id",
    );
    expect(response.headers.get("access-control-expose-headers")).toContain(
      "RateLimit-Reset",
    );
  });

  it("rejects oversized authentication request bodies", async () => {
    const limitedApp = createApiApp({
      bodyLimitBytes: 8,
      corsOrigins: ["http://localhost:3000"],
      logger: createLogger({ service: "api", sink: () => {} }),
      rateLimiter: false,
    });
    const response = await limitedApp.request("/auth/login", {
      body: JSON.stringify({ content: "long content" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: "Payload Too Large",
    });
  });

  it("returns standard rate-limit metadata", async () => {
    const limitedApp = createApiApp({
      corsOrigins: ["http://localhost:3000"],
      logger: createLogger({ service: "api", sink: () => {} }),
      rateLimit: { requests: 1, windowMs: 60_000 },
    });
    await limitedApp.request("/auth/token", {
      body: JSON.stringify({ grant_type: "invalid" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const response = await limitedApp.request("/auth/token", {
      body: JSON.stringify({ grant_type: "invalid" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(response.status).toBe(429);
    expect(response.headers.get("ratelimit-limit")).toBe("1");
    expect(response.headers.get("retry-after")).toBeTruthy();
  });

  it("sets restrictive API response headers", async () => {
    const response = await app.request("/health/live");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("permissions-policy")).toContain("camera=()");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cross-origin-resource-policy")).toBe(
      "same-site",
    );
  });

  it("accepts the separate Gourmet Action key and preserves idempotency headers", async () => {
    const entry = {
      area: "서울",
      cookingMethods: [],
      createdAt: "2026-08-05T00:00:00.000Z",
      cuisineTags: ["한식"],
      discoveries: [],
      externalRequestId: "mobile-1",
      freeTextNote: null,
      id: "meal-1",
      images: [],
      ingredients: ["쌀"],
      liked: [],
      menuName: "비빔밥",
      nutritionTags: [],
      postMealNotes: [],
      rating: 8.5,
      restaurantBranch: null,
      restaurantName: "Beat 식당",
      revisit: "yes",
      revision: 1,
      schemaVersion: 1,
      slug: "beat-meal-meal-1",
      source: "chatgpt",
      status: "published",
      summary: "채소가 신선한 비빔밥",
      tasteNotes: [],
      updatedAt: "2026-08-05T00:00:00.000Z",
      visitedAt: "2026-08-05",
    } as const;
    const create = vi.fn(async () => entry);
    const gourmetApp = createApiApp({
      corsOrigins: ["http://localhost:3000"],
      gourmet: {
        attachImage: vi.fn(),
        context: vi.fn(),
        create,
        delete: vi.fn(),
        get: vi.fn(async () => ({ entry, etag: '"v1"' })),
        list: vi.fn(async () => ({ entries: [entry], page: 1, total: 1 })),
        update: vi.fn(async () => entry),
      } as never,
      gourmetActionApiKey: "gourmet-action-key-at-least-32-characters",
      logger: createLogger({ service: "api", sink: () => {} }),
      rateLimiter: false,
    });
    const response = await gourmetApp.request("/api/gourmet/entries", {
      body: JSON.stringify({
        area: "서울",
        cookingMethods: [],
        cuisineTags: ["한식"],
        discoveries: [],
        externalRequestId: "mobile-1",
        freeTextNote: null,
        ingredients: ["쌀"],
        liked: [],
        menuName: "비빔밥",
        nutritionTags: [],
        postMealNotes: [],
        rating: 8.5,
        restaurantBranch: null,
        restaurantName: "Beat 식당",
        revisit: "yes",
        source: "chatgpt",
        status: "published",
        summary: "채소가 신선한 비빔밥",
        tasteNotes: [],
        visitedAt: "2026-08-05",
      }),
      headers: {
        Authorization: "Bearer gourmet-action-key-at-least-32-characters",
        "Content-Type": "application/json",
        "Idempotency-Key": "custom-gpt-message-1",
      },
      method: "POST",
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      detailUrl: expect.stringContaining("/gourmet/?entry="),
      status: "saved",
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantName: "Beat 식당" }),
      expect.objectContaining({
        idempotencyKey: "custom-gpt-message-1",
        subject: "chatgpt-action",
      }),
    );
  });

  it("rejects missing Gourmet authentication and invalid half-step ratings", async () => {
    const gourmetApp = createApiApp({
      corsOrigins: ["http://localhost:3000"],
      gourmet: {
        attachImage: vi.fn(),
        context: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
        get: vi.fn(),
        list: vi.fn(),
        update: vi.fn(),
      } as never,
      gourmetActionApiKey: "gourmet-action-key-at-least-32-characters",
      logger: createLogger({ service: "api", sink: () => {} }),
      rateLimiter: false,
    });
    const unauthorized = await gourmetApp.request("/api/gourmet/entries", {
      body: "{}",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(unauthorized.status).toBe(401);
    const invalid = await gourmetApp.request("/api/gourmet/entries", {
      body: JSON.stringify({
        menuName: "메뉴",
        rating: 8.3,
        restaurantName: "식당",
        revisit: "unknown",
        summary: "요약",
      }),
      headers: {
        Authorization: "Bearer gourmet-action-key-at-least-32-characters",
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toMatchObject({
      error: { code: "INVALID_REQUEST" },
    });
  });

  it("issues, refreshes, and revokes Beat token pairs", async () => {
    const tokenPair = {
      access_token: "access-token",
      expires_in: 600,
      refresh_expires_in: 2_592_000,
      refresh_token: "session.1.secret",
      token_type: "Bearer" as const,
    };
    const revokeRefreshToken = vi.fn(async () => {});
    const authApp = createApiApp({
      beatAuth: {
        authenticate: vi.fn(async () => ({
          adminKey: "v1/admins/admin.json",
          credentialVersion: 1,
          email: "admin@example.com",
          passwordHash: "hidden",
          role: "admin" as const,
          subject: "admin-1",
        })),
        issueTokenPair: vi.fn(async () => tokenPair),
        jwks: vi.fn(async () => ({ keys: [] })),
        refreshTokenPair: vi.fn(async () => tokenPair),
        revokeRefreshToken,
        verifyAccessToken: vi.fn(async () => ({
          email: "admin@example.com",
          subject: "admin-1",
        })),
      },
      corsOrigins: ["http://localhost:3000"],
      logger: createLogger({ service: "api", sink: () => {} }),
      rateLimiter: false,
    });
    const login = await authApp.request("/auth/login", {
      body: JSON.stringify({
        email: "admin@example.com",
        password: "correct horse battery staple",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(login.status).toBe(200);
    expect(login.headers.get("cache-control")).toBe("no-store");
    await expect(login.json()).resolves.toMatchObject(tokenPair);

    const refresh = await authApp.request("/auth/token", {
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokenPair.refresh_token,
      }),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    });
    expect(refresh.status).toBe(200);
    await expect(refresh.json()).resolves.toMatchObject(tokenPair);

    const revoke = await authApp.request("/auth/revoke", {
      body: JSON.stringify({ token: tokenPair.refresh_token }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(revoke.status).toBe(200);
    expect(revokeRefreshToken).toHaveBeenCalledWith(tokenPair.refresh_token);

    const emptyRevoke = await authApp.request("/auth/revoke", {
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(emptyRevoke.status).toBe(200);
    expect(revokeRefreshToken).toHaveBeenCalledTimes(1);
  });

  it("runs the Authorization Code + PKCE contract and preserves state on errors", async () => {
    vi.stubEnv(
      "BEAT_AUTH_CLIENTS_JSON",
      JSON.stringify([
        {
          client_id: "beat-agent-web",
          redirect_uris: ["https://agent.example.com/auth/callback/"],
          post_logout_redirect_uris: [
            "https://agent.example.com/auth/logout-callback/",
          ],
          scopes: ["openid", "profile", "email", "offline_access"],
        },
      ]),
    );
    const administrator = {
      adminKey: "v1/admins/admin.json",
      credentialVersion: 1,
      email: "admin@example.com",
      passwordHash: "hidden",
      role: "admin" as const,
      subject: "admin-1",
    };
    const tokenPair = {
      access_token: "access-token",
      expires_in: 600,
      id_token: "id-token",
      refresh_expires_in: 2_592_000,
      refresh_token: "session.1.secret",
      token_type: "Bearer" as const,
    };
    const issueAuthorizationCode = vi.fn(async () => "authorization-code");
    const redeemAuthorizationCode = vi.fn(async () => tokenPair);
    const authApp = createApiApp({
      beatAuth: {
        authenticate: vi.fn(async () => administrator),
        issueAuthorizationCode,
        issueTokenPair: vi.fn(),
        jwks: vi.fn(async () => ({ keys: [] })),
        redeemAuthorizationCode,
        refreshTokenPair: vi.fn(async () => tokenPair),
        revokeRefreshToken: vi.fn(async () => {}),
        verifyAccessToken: vi.fn(async () => ({
          email: administrator.email,
          subject: administrator.subject,
        })),
        verifyIdTokenHint: vi.fn(async (hint) => {
          if (hint === "invalid") throw new Error("invalid id token");
          return { clientId: "beat-agent-web", subject: administrator.subject };
        }),
      },
      corsOrigins: ["https://agent.example.com"],
      beatOidcClientsJson: oidcClientsJson,
      logger: createLogger({ service: "api", sink: () => {} }),
      rateLimiter: false,
    });
    const params = {
      client_id: "beat-agent-web",
      redirect_uri: "https://agent.example.com/auth/callback/",
      response_type: "code",
      scope: "openid profile email offline_access",
      state: "state-value",
      nonce: "nonce-value",
      code_challenge: "A".repeat(43),
      code_challenge_method: "S256",
    };
    const form = await authApp.request(
      `/auth/authorize?${new URLSearchParams(params)}`,
    );
    expect(form.status).toBe(200);
    expect(await form.text()).not.toContain("access_token");
    const authorization = await authApp.request("/auth/authorize", {
      body: new URLSearchParams({
        ...params,
        email: administrator.email,
        password: "correct horse battery staple",
      }),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    });
    expect(authorization.status).toBe(302);
    const callback = new URL(authorization.headers.get("location")!);
    expect(callback.origin + callback.pathname).toBe(
      "https://agent.example.com/auth/callback/",
    );
    expect(callback.searchParams.get("state")).toBe("state-value");
    expect(callback.searchParams.get("code")).toBe("authorization-code");
    const token = await authApp.request("/auth/token", {
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: "authorization-code",
        client_id: "beat-agent-web",
        redirect_uri: "https://agent.example.com/auth/callback/",
        code_verifier: "verifier",
      }),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    });
    expect(token.status).toBe(200);
    await expect(token.json()).resolves.toMatchObject(tokenPair);
    expect(redeemAuthorizationCode).toHaveBeenCalledWith({
      clientId: "beat-agent-web",
      code: "authorization-code",
      codeVerifier: "verifier",
      redirectUri: "https://agent.example.com/auth/callback/",
    });
    const logout = await authApp.request(
      "/auth/logout?id_token_hint=id-token&post_logout_redirect_uri=https%3A%2F%2Fagent.example.com%2Fauth%2Flogout-callback%2F&state=logout-state",
    );
    expect(logout.status).toBe(302);
    expect(
      new URL(logout.headers.get("location")!).searchParams.get("state"),
    ).toBe("logout-state");
    const logoutWithoutRedirect = await authApp.request(
      "/auth/logout?client_id=beat-agent-web",
    );
    expect(logoutWithoutRedirect.status).toBe(204);
    const invalidLogout = await authApp.request(
      "/auth/logout?id_token_hint=invalid&post_logout_redirect_uri=https%3A%2F%2Fagent.example.com%2Fauth%2Flogout-callback%2F",
    );
    expect(invalidLogout.status).toBe(400);

    const deniedApp = createApiApp({
      beatAuth: {
        authenticate: vi.fn(async () => undefined),
        issueTokenPair: vi.fn(),
        jwks: vi.fn(async () => ({ keys: [] })),
        refreshTokenPair: vi.fn(),
        revokeRefreshToken: vi.fn(),
        verifyAccessToken: vi.fn(),
      },
      corsOrigins: ["https://agent.example.com"],
      beatOidcClientsJson: oidcClientsJson,
      logger: createLogger({ service: "api", sink: () => {} }),
      rateLimiter: false,
    });
    const denied = await deniedApp.request("/auth/authorize", {
      body: new URLSearchParams(params),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    });
    expect(denied.status).toBe(302);
    const deniedLocation = new URL(denied.headers.get("location")!);
    expect(deniedLocation.searchParams.get("error")).toBe("access_denied");
    expect(deniedLocation.searchParams.get("state")).toBe("state-value");
  });

  it("returns OAuth errors for invalid credentials and refresh tokens", async () => {
    const authApp = createApiApp({
      beatAuth: {
        authenticate: vi.fn(async () => undefined),
        issueTokenPair: vi.fn(),
        jwks: vi.fn(async () => ({ keys: [] })),
        refreshTokenPair: vi.fn(async () => {
          throw Object.assign(new Error("invalid"), {
            code: "invalid_refresh_token",
          });
        }),
        revokeRefreshToken: vi.fn(async () => {}),
        verifyAccessToken: vi.fn(async () => ({
          email: "admin@example.com",
          subject: "admin-1",
        })),
      },
      corsOrigins: ["http://localhost:3000"],
      logger: createLogger({ service: "api", sink: () => {} }),
      rateLimiter: false,
    });
    const login = await authApp.request("/auth/login", {
      body: JSON.stringify({
        email: "admin@example.com",
        password: "wrong",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(login.status).toBe(401);
    const malformedLogin = await authApp.request("/auth/login", {
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(malformedLogin.status).toBe(400);

    const refresh = await authApp.request("/auth/refresh", {
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: "session.1.old",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(refresh.status).toBe(400);
    await expect(refresh.json()).resolves.toMatchObject({
      error: "invalid_grant",
    });
    const malformedRefresh = await authApp.request("/auth/token", {
      body: JSON.stringify({ grant_type: "authorization_code" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(malformedRefresh.status).toBe(400);
  });

  it("loads, saves, and confirms S3-backed content for an administrator", async () => {
    const draft = {
      revision: 1,
      schemaVersion: 1 as const,
      slug: "weekly-test",
      source: "---\ntitle: Test\n---\n\nDraft",
      status: "draft" as const,
      title: "Test",
      updatedAt: "2026-07-30T00:00:00.000Z",
      updatedBy: "admin-1",
    };
    const saveDraft = vi.fn(async () => draft);
    const listRevisions = vi.fn(async () => [
      {
        revision: 1,
        schemaVersion: 1 as const,
        slug: "weekly-test",
        sourceBytes: 32,
        status: "draft" as const,
        title: "Test",
        updatedAt: "2026-07-30T00:00:00.000Z",
        updatedBy: "admin-1",
      },
    ]);
    const getRevision = vi.fn(async () => draft);
    const restoreRevision = vi.fn(async () => ({ ...draft, revision: 2 }));
    const listRecords = vi.fn(async () => [
      {
        origin: "repository" as const,
        revision: 0,
        slug: "weekly-test",
        status: "published" as const,
        title: "Test",
      },
    ]);
    const confirmAndPublish = vi.fn(async () => ({
      branch: "content/weekly-test-r2",
      draftRevision: 2,
      idempotencyKey: "weekly-test:2",
      prUrl: "https://github.com/arlequins/beat/pull/10",
      schemaVersion: 1 as const,
      slug: "weekly-test",
      status: "opened" as const,
      updatedAt: "2026-07-30T00:01:00.000Z",
    }));
    const adminApp = createApiApp({
      beatAuth: {
        authenticate: vi.fn(),
        issueTokenPair: vi.fn(),
        jwks: vi.fn(async () => ({ keys: [] })),
        refreshTokenPair: vi.fn(),
        revokeRefreshToken: vi.fn(async () => {}),
        verifyAccessToken: vi.fn(async () => ({
          email: "admin@example.com",
          subject: "admin-1",
        })),
      },
      beatContent: {
        confirmAndPublish,
        getDraft: vi.fn(async () => draft),
        getRevision,
        listRecords,
        listRevisions,
        restoreRevision,
        saveDraft,
      },
      corsOrigins: ["http://localhost:3000"],
      logger: createLogger({ service: "api", sink: () => {} }),
      rateLimiter: false,
    });
    const headers = {
      Authorization: "Bearer access-token",
      "Content-Type": "application/json",
    };
    const records = await adminApp.request("/admin/content", { headers });
    expect(records.status).toBe(200);
    await expect(records.json()).resolves.toMatchObject({
      records: [{ slug: "weekly-test", status: "published" }],
    });
    expect(listRecords).toHaveBeenCalledOnce();

    const loaded = await adminApp.request("/admin/content/drafts/weekly-test", {
      headers,
    });
    expect(loaded.status).toBe(200);
    await expect(loaded.json()).resolves.toMatchObject({ revision: 1 });

    const history = await adminApp.request(
      "/admin/content/drafts/weekly-test/revisions",
      { headers },
    );
    expect(history.status).toBe(200);
    await expect(history.json()).resolves.toMatchObject({
      revisions: [{ revision: 1, updatedBy: "admin-1" }],
    });
    const historical = await adminApp.request(
      "/admin/content/drafts/weekly-test/revisions/1",
      { headers },
    );
    expect(historical.status).toBe(200);
    expect(getRevision).toHaveBeenCalledWith("weekly-test", 1);

    const saved = await adminApp.request("/admin/content/drafts/weekly-test", {
      body: JSON.stringify({
        expectedRevision: 0,
        source: draft.source,
        title: draft.title,
      }),
      headers,
      method: "PUT",
    });
    expect(saved.status).toBe(200);
    expect(saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({ updatedBy: "admin-1" }),
    );

    const restored = await adminApp.request(
      "/admin/content/drafts/weekly-test/restore",
      {
        body: JSON.stringify({ expectedRevision: 1, revision: 1 }),
        headers,
        method: "POST",
      },
    );
    expect(restored.status).toBe(200);
    expect(restoreRevision).toHaveBeenCalledWith({
      expectedRevision: 1,
      revision: 1,
      slug: "weekly-test",
      updatedBy: "admin-1",
    });

    const confirmed = await adminApp.request(
      "/admin/content/drafts/weekly-test/confirm",
      {
        body: JSON.stringify({ expectedRevision: 1 }),
        headers,
        method: "POST",
      },
    );
    expect(confirmed.status).toBe(200);
    await expect(confirmed.json()).resolves.toMatchObject({
      prUrl: "https://github.com/arlequins/beat/pull/10",
    });
    expect(confirmAndPublish).toHaveBeenCalledWith({
      expectedRevision: 1,
      slug: "weekly-test",
      subject: "admin-1",
    });
  });

  it("protects content routes and maps draft conflicts", async () => {
    const getDraft = vi.fn(async () => undefined);
    const saveDraft = vi.fn(async () => {
      throw Object.assign(new Error("conflict"), { code: "conflict" });
    });
    const adminApp = createApiApp({
      beatAuth: {
        authenticate: vi.fn(),
        issueTokenPair: vi.fn(),
        jwks: vi.fn(async () => ({ keys: [] })),
        refreshTokenPair: vi.fn(),
        revokeRefreshToken: vi.fn(async () => {}),
        verifyAccessToken: vi.fn(async (token) => {
          if (token === "invalid") throw new Error("invalid");
          return { email: "admin@example.com", subject: "admin-1" };
        }),
      },
      beatContent: {
        confirmAndPublish: vi.fn(),
        getDraft,
        saveDraft,
      },
      corsOrigins: ["http://localhost:3000"],
      logger: createLogger({ service: "api", sink: () => {} }),
      rateLimiter: false,
    });
    const unauthorized = await adminApp.request(
      "/admin/content/drafts/weekly-test",
      { headers: { Authorization: "Bearer invalid" } },
    );
    expect(unauthorized.status).toBe(401);
    expect(getDraft).not.toHaveBeenCalled();

    const missing = await adminApp.request(
      "/admin/content/drafts/weekly-test",
      { headers: { Authorization: "Bearer valid" } },
    );
    expect(missing.status).toBe(404);

    const invalidDraft = await adminApp.request(
      "/admin/content/drafts/weekly-test",
      {
        body: JSON.stringify({
          expectedRevision: "one",
          source: 123,
          title: null,
        }),
        headers: {
          Authorization: "Bearer valid",
          "Content-Type": "application/json",
        },
        method: "PUT",
      },
    );
    expect(invalidDraft.status).toBe(400);

    const conflict = await adminApp.request(
      "/admin/content/drafts/weekly-test",
      {
        body: JSON.stringify({
          expectedRevision: 1,
          source: "---\ntitle: Test\n---\n\nDraft",
          title: "Test",
        }),
        headers: {
          Authorization: "Bearer valid",
          "Content-Type": "application/json",
        },
        method: "PUT",
      },
    );
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toMatchObject({
      error: "Draft revision conflict",
    });

    const invalid = await adminApp.request(
      "/admin/content/drafts/weekly-test/confirm",
      {
        body: JSON.stringify({ expectedRevision: "one" }),
        headers: {
          Authorization: "Bearer valid",
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );
    expect(invalid.status).toBe(400);

    saveDraft.mockRejectedValueOnce(
      Object.assign(new Error("invalid"), { code: "invalid_draft" }),
    );
    const rejectedDraft = await adminApp.request(
      "/admin/content/drafts/weekly-test",
      {
        body: JSON.stringify({
          expectedRevision: 1,
          source: "---\ntitle: Test\n---\n\nDraft",
          title: "Test",
        }),
        headers: {
          Authorization: "Bearer valid",
          "Content-Type": "application/json",
        },
        method: "PUT",
      },
    );
    expect(rejectedDraft.status).toBe(400);
  });

  it("enforces public, Action, and administrator Gourmet route boundaries", async () => {
    const baseEntry = {
      area: "서울",
      cookingMethods: [],
      createdAt: "2026-08-05T00:00:00.000Z",
      cuisineTags: [],
      discoveries: [],
      externalRequestId: null,
      freeTextNote: null,
      id: "published-entry",
      images: [],
      ingredients: [],
      liked: [],
      menuName: "메뉴",
      nutritionTags: [],
      postMealNotes: [],
      rating: 8,
      restaurantBranch: null,
      restaurantName: "식당",
      revisit: "yes",
      revision: 1,
      schemaVersion: 1,
      slug: "published-entry",
      source: "manual",
      status: "published",
      summary: "요약",
      tasteNotes: [],
      updatedAt: "2026-08-05T00:00:00.000Z",
      visitedAt: "2026-08-05",
    } as const;
    const draftEntry = {
      ...baseEntry,
      id: "draft-entry",
      slug: "draft-entry",
      status: "draft" as const,
    };
    const deletedEntry = {
      ...baseEntry,
      id: "deleted-entry",
      slug: "deleted-entry",
      status: "deleted" as const,
    };
    const list = vi.fn(async () => ({
      entries: [baseEntry],
      page: 1,
      total: 1,
    }));
    const update = vi.fn(async (id: string) => {
      if (id === "conflict") throw new GourmetError("conflict", "stale");
      return baseEntry;
    });
    const gourmetLogs: LogRecord[] = [];
    const gourmetApp = createApiApp({
      beatAuth: {
        authenticate: vi.fn(),
        issueTokenPair: vi.fn(),
        jwks: vi.fn(async () => ({ keys: [] })),
        refreshTokenPair: vi.fn(),
        revokeRefreshToken: vi.fn(async () => {}),
        verifyAccessToken: vi.fn(async (token) => {
          if (token !== "admin-token") throw new Error("invalid");
          return { email: "admin@example.com", subject: "admin-1" };
        }),
      },
      corsOrigins: ["http://localhost:3000"],
      gourmet: {
        attachImage: vi.fn(async () => ({
          ...baseEntry,
          images: [
            {
              altText: "사진",
              byteSize: 32,
              createdAt: "2026-08-05T00:00:00.000Z",
              height: null,
              id: "image-1",
              mimeType: "image/webp",
              originalFilename: "meal.webp",
              prUrl: "https://github.com/arlequins/beat/pull/40",
              publicPath: "/gourmet/image.webp",
              repositoryPath: "apps/web/public/gourmet/image.webp",
              sortOrder: 0,
              storageKey: "apps/web/public/gourmet/image.webp",
              width: null,
            },
          ],
        })),
        context: vi.fn(async () => ({ averageRating: 8 })),
        create: vi.fn(async () => baseEntry),
        delete: vi.fn(async () => deletedEntry),
        get: vi.fn(async (id: string) => {
          if (id === "missing") return undefined;
          return {
            entry: id === "draft-entry" ? draftEntry : baseEntry,
            etag: '"v1"',
          };
        }),
        getImage: vi.fn(async () => ({
          body: new Uint8Array([0x52, 0x49, 0x46, 0x46]),
          contentLength: 4,
          contentType: "image/webp" as const,
          etag: '"image-v1"',
          lastModified: new Date("2026-08-05T00:00:00.000Z"),
        })),
        getAdminImage: vi.fn(async () => ({
          body: new Uint8Array([0x52, 0x49, 0x46, 0x46]),
          contentLength: 4,
          contentType: "image/webp" as const,
          etag: '"image-v1"',
          lastModified: new Date("2026-08-05T00:00:00.000Z"),
        })),
        list,
        removeImage: vi.fn(async () => baseEntry),
        update,
      } as never,
      gourmetActionApiKey: "gourmet-action-key-at-least-32-characters",
      logger: createLogger({
        service: "api",
        sink: (record) => gourmetLogs.push(record),
      }),
      rateLimiter: false,
    });
    const actionHeaders = {
      Authorization: "Bearer gourmet-action-key-at-least-32-characters",
      "Content-Type": "application/json",
    };
    const adminHeaders = {
      Authorization: "Bearer admin-token",
      "Content-Type": "application/json",
    };

    const publicList = await gourmetApp.request(
      "/api/gourmet/entries?area=%EC%84%9C%EC%9A%B8&pageSize=10",
    );
    expect(publicList.status).toBe(200);
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        area: "서울",
        pageSize: 10,
        status: "published",
      }),
    );
    expect(
      (await gourmetApp.request("/api/gourmet/entries?page=zero")).status,
    ).toBe(400);
    expect(
      (await gourmetApp.request("/api/gourmet/entries?status=draft")).status,
    ).toBe(403);

    expect((await gourmetApp.request("/api/gourmet/context")).status).toBe(401);
    expect(
      (
        await gourmetApp.request("/api/gourmet/context?days=30&limit=5", {
          headers: actionHeaders,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await gourmetApp.request("/api/gourmet/context?days=invalid", {
          headers: actionHeaders,
        })
      ).status,
    ).toBe(400);

    expect(
      (await gourmetApp.request("/api/gourmet/entries/published-entry")).status,
    ).toBe(200);
    const image = await gourmetApp.request(
      "/api/gourmet/images/published-entry/image-1",
    );
    expect(image.status).toBe(200);
    expect(image.headers.get("content-type")).toBe("image/webp");
    expect(image.headers.get("cross-origin-resource-policy")).toBe(
      "cross-origin",
    );
    expect(
      (
        await gourmetApp.request(
          "/api/gourmet/images/published-entry/image-1",
          { headers: { "If-None-Match": '"image-v1"' } },
        )
      ).status,
    ).toBe(304);
    expect(
      (await gourmetApp.request("/api/gourmet/entries/draft-entry")).status,
    ).toBe(404);
    expect(
      (
        await gourmetApp.request("/api/gourmet/entries/draft-entry", {
          headers: adminHeaders,
        })
      ).status,
    ).toBe(200);
    expect(
      (await gourmetApp.request("/api/gourmet/entries/missing")).status,
    ).toBe(404);

    expect(
      (
        await gourmetApp.request("/api/gourmet/entries/published-entry", {
          body: JSON.stringify({ rating: 9 }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await gourmetApp.request("/api/gourmet/entries/published-entry", {
          body: JSON.stringify({ expectedRevision: 1, rating: 9 }),
          headers: actionHeaders,
          method: "PATCH",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await gourmetApp.request("/api/gourmet/entries/conflict", {
          body: JSON.stringify({ rating: 9 }),
          headers: actionHeaders,
          method: "PATCH",
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await gourmetApp.request("/api/gourmet/entries/published-entry", {
          body: JSON.stringify({ rating: 11 }),
          headers: actionHeaders,
          method: "PATCH",
        })
      ).status,
    ).toBe(400);

    expect(
      (
        await gourmetApp.request("/api/gourmet/entries/published-entry", {
          headers: actionHeaders,
          method: "DELETE",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await gourmetApp.request("/api/gourmet/entries/published-entry", {
          headers: adminHeaders,
          method: "DELETE",
        })
      ).status,
    ).toBe(200);

    expect(
      (
        await gourmetApp.request(
          "/admin/gourmet/entries/published-entry/images",
          { body: "{}", headers: actionHeaders, method: "POST" },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await gourmetApp.request(
          "/admin/gourmet/entries/published-entry/images",
          { body: "{}", headers: adminHeaders, method: "POST" },
        )
      ).status,
    ).toBe(400);
    const attached = await gourmetApp.request(
      "/admin/gourmet/entries/published-entry/images",
      {
        body: JSON.stringify({
          altText: "사진",
          contentBase64: "UklGRgAAAABXRUJQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          contentType: "image/webp",
          originalFilename: "meal.webp",
        }),
        headers: {
          ...adminHeaders,
          "X-Client-Request-Id": "chatgpt-export-123",
        },
        method: "POST",
      },
    );
    expect(attached.status).toBe(200);
    expect(gourmetLogs).toContainEqual(
      expect.objectContaining({
        clientRequestId: "chatgpt-export-123",
        entryId: "published-entry",
        imageCount: 1,
        message: "gourmet.image_attached",
      }),
    );
    const adminImage = await gourmetApp.request(
      "/admin/gourmet/entries/published-entry/images/image-1",
      { headers: adminHeaders },
    );
    expect(adminImage.status).toBe(200);
    expect(adminImage.headers.get("cache-control")).toBe("private, no-store");
    expect(
      (
        await gourmetApp.request(
          "/admin/gourmet/entries/published-entry/images/image-1",
          { headers: actionHeaders, method: "DELETE" },
        )
      ).status,
    ).toBe(403);
    const removed = await gourmetApp.request(
      "/admin/gourmet/entries/published-entry/images/image-1",
      { headers: adminHeaders, method: "DELETE" },
    );
    expect(removed.status).toBe(200);
  });
});
