import type { LogRecord } from "@acme/logger";
import { createLogger } from "@acme/logger";
import { describe, expect, it, vi } from "vitest";

import { createApiApp } from "./app";

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
    const loaded = await adminApp.request("/admin/content/drafts/weekly-test", {
      headers,
    });
    expect(loaded.status).toBe(200);
    await expect(loaded.json()).resolves.toMatchObject({ revision: 1 });

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
});
