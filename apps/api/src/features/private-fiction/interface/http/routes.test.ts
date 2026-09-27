import { createLogger } from "@arlequins/logger";
import { describe, expect, it, vi } from "vitest";
import { createApiApp } from "../../../../app";
import { GOOGLE_ALLOWED_EMAIL } from "../../../../beat-google";

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
  });
});
