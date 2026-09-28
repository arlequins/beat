import { createLogger } from "@arlequins/logger";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiApp } from "../../../../app";
import { GOOGLE_ALLOWED_EMAIL } from "../../../../beat-google";
import { PrivateFictionStorageError } from "../../s3-private-fiction-repository";

afterEach(() => vi.unstubAllEnvs());

describe("private fiction routes", () => {
  it("requires a verified owner account and never touches storage for other accounts", async () => {
    const store = { get: vi.fn(), save: vi.fn() };
    const app = createApiApp({
      corsOrigins: [],
      logger: createLogger({ service: "api", sink: () => {} }),
      privateFiction: store,
      rateLimiter: false,
      beatAuth: {
        authenticate: vi.fn(),
        issueTokenPair: vi.fn(),
        jwks: vi.fn(async () => ({ keys: [] })),
        refreshTokenPair: vi.fn(),
        revokeRefreshToken: vi.fn(),
        verifyAccessToken: vi.fn(async (token) => {
          if (token === "other")
            return { email: "other@example.com", subject: "account-2" };
          return { email: GOOGLE_ALLOWED_EMAIL, subject: "account-1" };
        }),
      },
    });

    const anonymous = await app.request("/admin/private-fiction");
    const otherAccount = await app.request("/admin/private-fiction", {
      headers: { Authorization: "Bearer other" },
    });
    expect(anonymous.status).toBe(401);
    expect(otherAccount.status).toBe(404);
    expect(store.get).not.toHaveBeenCalled();
    expect(store.save).not.toHaveBeenCalled();
  });

  it("serves private source without cache and accepts a conditional owner save", async () => {
    const document = {
      etag: '"revision-1"',
      source: "# private outline",
      updatedAt: "2026-09-27T00:00:00.000Z",
    };
    const store = {
      get: vi.fn(async () => document),
      save: vi.fn(async () => ({
        etag: '"revision-2"',
        updatedAt: document.updatedAt,
      })),
    };
    const app = createApiApp({
      corsOrigins: [],
      logger: createLogger({ service: "api", sink: () => {} }),
      privateFiction: store,
      rateLimiter: false,
      beatAuth: {
        authenticate: vi.fn(),
        issueTokenPair: vi.fn(),
        jwks: vi.fn(async () => ({ keys: [] })),
        refreshTokenPair: vi.fn(),
        revokeRefreshToken: vi.fn(),
        verifyAccessToken: vi.fn(async () => ({
          email: GOOGLE_ALLOWED_EMAIL,
          subject: "owner-account-id",
        })),
      },
    });
    const headers = {
      Authorization: "Bearer owner",
      "Content-Type": "application/json",
    };

    const response = await app.request("/admin/private-fiction", { headers });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(response.json()).resolves.toEqual(document);
    const saved = await app.request("/admin/private-fiction", {
      body: JSON.stringify({
        expectedEtag: document.etag,
        source: "# revised",
      }),
      headers,
      method: "PUT",
    });
    expect(saved.status).toBe(200);
    expect(store.save).toHaveBeenCalledWith({
      expectedEtag: document.etag,
      source: "# revised",
    });

    const largeSource = "x".repeat(2_200_000);
    const largeSave = await app.request("/admin/private-fiction", {
      body: JSON.stringify({
        expectedEtag: '"revision-2"',
        source: largeSource,
      }),
      headers,
      method: "PUT",
    });
    expect(largeSave.status).toBe(200);
    expect(store.save).toHaveBeenLastCalledWith({
      expectedEtag: '"revision-2"',
      source: largeSource,
    });
  });

  it("handles missing objects, malformed writes, conflicts, and storage failures", async () => {
    const store = {
      get: vi.fn(
        async () =>
          undefined as
            | { etag: string; source: string; updatedAt: string }
            | undefined,
      ),
      save: vi.fn(async () => ({ etag: '"revision"', updatedAt: "now" })),
    };
    const app = createApiApp({
      corsOrigins: [],
      logger: createLogger({ service: "api", sink: () => {} }),
      privateFiction: store,
      rateLimiter: false,
      beatAuth: {
        authenticate: vi.fn(),
        issueTokenPair: vi.fn(),
        jwks: vi.fn(async () => ({ keys: [] })),
        refreshTokenPair: vi.fn(),
        revokeRefreshToken: vi.fn(),
        verifyAccessToken: vi.fn(async (token) => {
          if (token === "invalid") throw new Error("bad token");
          if (token === "empty-subject")
            return { email: GOOGLE_ALLOWED_EMAIL, subject: "  " };
          return { email: GOOGLE_ALLOWED_EMAIL, subject: "owner-id" };
        }),
      },
    });
    const get = (token = "owner") =>
      app.request("/admin/private-fiction", {
        headers: { Authorization: `Bearer ${token}` },
      });
    const put = (body: string, token = "owner") =>
      app.request("/admin/private-fiction", {
        body,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "PUT",
      });

    expect((await get("invalid")).status).toBe(401);
    expect((await get("empty-subject")).status).toBe(404);
    expect((await get()).status).toBe(404);
    store.get.mockRejectedValueOnce(new Error("s3 failure"));
    expect((await get()).status).toBe(503);
    expect((await put("not-json")).status).toBe(400);
    expect((await put(JSON.stringify({ source: "missing etag" }))).status).toBe(
      400,
    );
    expect(
      (
        await put(
          JSON.stringify({
            expectedEtag: null,
            source: "가".repeat(1_333_334),
          }),
        )
      ).status,
    ).toBe(400);
    store.save.mockRejectedValueOnce(
      new PrivateFictionStorageError("conflict"),
    );
    expect(
      (await put(JSON.stringify({ expectedEtag: null, source: "draft" })))
        .status,
    ).toBe(409);
    store.save.mockRejectedValueOnce(new Error("s3 failure"));
    expect(
      (await put(JSON.stringify({ expectedEtag: null, source: "draft" })))
        .status,
    ).toBe(503);
  });
});
