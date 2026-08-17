import { createLogger } from "@arlequins/logger";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiApp } from "./app";
import type { GourmetPort } from "./gourmet-routes";

const entry = {
  area: "Tokyo",
  cookingMethods: [],
  createdAt: "2026-08-17T00:00:00.000Z",
  cuisineTags: ["Japanese"],
  discoveries: [],
  externalRequestId: "mcp:entry",
  freeTextNote: null,
  id: "entry-1",
  images: [],
  ingredients: [],
  liked: ["charcoal aroma"],
  menuName: "Tasting menu",
  nutritionTags: [],
  postMealNotes: [],
  rating: 8.5,
  restaurantBranch: null,
  restaurantName: "Example",
  revisit: "yes" as const,
  revision: 1,
  schemaVersion: 1 as const,
  slug: "example-tasting-menu-entry-1",
  source: "chatgpt" as const,
  status: "draft" as const,
  summary: "A warm and balanced meal.",
  tasteNotes: ["savory"],
  updatedAt: "2026-08-17T00:00:00.000Z",
  visitedAt: "2026-08-16",
};

const record = {
  menuName: "Tasting menu",
  rating: 8.5,
  restaurantName: "Example",
  revisit: "yes",
  summary: "A warm and balanced meal.",
};

function rpc(id: string, method: string, params?: Record<string, unknown>) {
  return {
    body: JSON.stringify({ id, jsonrpc: "2.0", method, params }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  } as const;
}

function appHarness(scopes = ["gourmet:read", "gourmet:write"]) {
  const create = vi.fn(async () => entry);
  const context = vi.fn(async () => ({
    recentEntries: [],
  })) as unknown as GourmetPort["context"];
  const app = createApiApp({
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
      verifyAccessTokenForAudience: vi.fn(async () => ({
        email: "admin@example.com",
        scopes,
        subject: "admin-1",
      })),
    },
    corsOrigins: ["https://chatgpt.com"],
    gourmet: {
      attachImage: vi.fn(),
      context,
      create,
      delete: vi.fn(),
      get: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
    },
    logger: createLogger({ service: "api", sink: () => {} }),
    mcp: {
      issuer: "https://api.example.com/auth",
      resource: "https://api.example.com/mcp",
    },
    rateLimiter: false,
  });
  return { app, context, create };
}

afterEach(() => vi.restoreAllMocks());

describe("Beat Gourmet MCP", () => {
  it("publishes protected-resource metadata and requires a bearer token", async () => {
    const { app } = appHarness();
    const metadata = await app.request("/.well-known/oauth-protected-resource");
    expect(metadata.status).toBe(200);
    await expect(metadata.json()).resolves.toEqual({
      authorization_servers: ["https://api.example.com/auth"],
      resource: "https://api.example.com/mcp",
      scopes_supported: ["gourmet:read", "gourmet:write"],
    });

    const unauthorized = await app.request("/mcp", rpc("1", "tools/list"));
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.headers.get("www-authenticate")).toContain(
      'resource_metadata="http://localhost/.well-known/oauth-protected-resource/mcp"',
    );

    const unauthCall = await app.request("/mcp", {
      ...rpc("1a", "tools/call", {
        arguments: { entries: [record] },
        name: "gourmet_preview_import",
      }),
    });
    expect(unauthCall.status).toBe(200);
    await expect(unauthCall.json()).resolves.toMatchObject({
      result: {
        _meta: {
          "mcp/www_authenticate": [expect.stringContaining("invalid_token")],
        },
        isError: true,
      },
    });

    const listed = await app.request("/mcp", {
      ...rpc("2", "tools/list"),
      headers: {
        Authorization: "Bearer mcp-token",
        "Content-Type": "application/json",
      },
    });
    expect(listed.status).toBe(200);
    await expect(listed.json()).resolves.toMatchObject({
      result: {
        tools: expect.arrayContaining([
          expect.objectContaining({ name: "gourmet_confirm_import" }),
        ]),
      },
    });

    const notification = await app.request(
      "/mcp",
      rpc("3", "notifications/initialized"),
    );
    expect(notification.status).toBe(202);

    const invalid = await app.request("/mcp", {
      body: "{}",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(invalid.status).toBe(400);

    const unsupportedVersion = await app.request("/mcp", {
      ...rpc("4", "initialize"),
      headers: {
        "Content-Type": "application/json",
        "MCP-Protocol-Version": "1999-01-01",
      },
    });
    expect(unsupportedVersion.status).toBe(400);
  });

  it("previews without writing and saves only an explicit confirmation", async () => {
    const { app, context, create } = appHarness();
    const initialized = await app.request(
      "/mcp",
      rpc("1", "initialize", {
        protocolVersion: "2025-06-18",
      }),
    );
    expect(initialized.status).toBe(200);
    await expect(initialized.json()).resolves.toMatchObject({
      result: { protocolVersion: "2025-06-18" },
    });

    const headers = { Authorization: "Bearer mcp-token" };
    const preview = await app.request(
      "/mcp",
      rpc("2", "tools/call", {
        arguments: { entries: [record], sourceConversation: "history-2026" },
        name: "gourmet_preview_import",
      }),
    );
    // Tool-level authentication errors are JSON-RPC results so ChatGPT can
    // surface its OAuth linking UI.
    expect(preview.status).toBe(200);
    await expect(preview.json()).resolves.toMatchObject({
      result: { isError: true },
    });

    const previewWithAuth = await app.request("/mcp", {
      ...rpc("3", "tools/call", {
        arguments: { entries: [record], sourceConversation: "history-2026" },
        name: "gourmet_preview_import",
      }),
      headers: { ...headers, "Content-Type": "application/json" },
    });
    expect(previewWithAuth.status).toBe(200);
    await expect(previewWithAuth.json()).resolves.toMatchObject({
      result: {
        structuredContent: {
          count: 1,
          requiresConfirmation: true,
          status: "preview",
        },
      },
    });
    expect(create).not.toHaveBeenCalled();

    const invalidConfirmation = await app.request("/mcp", {
      ...rpc("4", "tools/call", {
        arguments: { confirmed: false, entries: [record] },
        name: "gourmet_confirm_import",
      }),
      headers: { ...headers, "Content-Type": "application/json" },
    });
    expect(invalidConfirmation.status).toBe(200);
    await expect(invalidConfirmation.json()).resolves.toMatchObject({
      error: { code: -32602 },
    });
    expect(create).not.toHaveBeenCalled();

    const confirmed = await app.request("/mcp", {
      ...rpc("5", "tools/call", {
        arguments: {
          confirmed: true,
          entries: [record],
          sourceConversation: "history-2026",
        },
        name: "gourmet_confirm_import",
      }),
      headers: { ...headers, "Content-Type": "application/json" },
    });
    expect(confirmed.status).toBe(200);
    await expect(confirmed.json()).resolves.toMatchObject({
      result: { structuredContent: { count: 1, status: "saved" } },
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ source: "chatgpt", status: "draft" }),
      expect.objectContaining({ subject: "admin-1" }),
    );
    expect(context).not.toHaveBeenCalled();

    const contextResponse = await app.request("/mcp", {
      ...rpc("6", "tools/call", {
        arguments: { days: 30, limit: 10 },
        name: "gourmet_get_context",
      }),
      headers: { ...headers, "Content-Type": "application/json" },
    });
    expect(contextResponse.status).toBe(200);
    expect(context).toHaveBeenCalledWith({ days: 30, limit: 10 });

    const unknownTool = await app.request("/mcp", {
      ...rpc("7", "tools/call", { arguments: {}, name: "unknown" }),
      headers: { ...headers, "Content-Type": "application/json" },
    });
    expect(unknownTool.status).toBe(404);
  });

  it("enforces separate read and write scopes", async () => {
    const { app } = appHarness(["gourmet:read"]);
    const response = await app.request("/mcp", {
      ...rpc("1", "tools/call", {
        arguments: { confirmed: true, entries: [record] },
        name: "gourmet_confirm_import",
      }),
      headers: {
        Authorization: "Bearer read-only-token",
        "Content-Type": "application/json",
      },
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      result: {
        _meta: {
          "mcp/www_authenticate": [expect.stringContaining("gourmet:write")],
        },
        isError: true,
      },
    });

    const { app: writeOnlyApp } = appHarness(["gourmet:write"]);
    const readOnlyPreview = await writeOnlyApp.request("/mcp", {
      ...rpc("2", "tools/call", {
        arguments: { entries: [record] },
        name: "gourmet_preview_import",
      }),
      headers: {
        Authorization: "Bearer write-only-token",
        "Content-Type": "application/json",
      },
    });
    expect(readOnlyPreview.status).toBe(200);
    await expect(readOnlyPreview.json()).resolves.toMatchObject({
      result: {
        _meta: {
          "mcp/www_authenticate": [expect.stringContaining("gourmet:read")],
        },
        isError: true,
      },
    });
  });

  it("returns a temporary-unavailable response when MCP is not configured", async () => {
    const app = createApiApp({
      corsOrigins: ["https://chatgpt.com"],
      logger: createLogger({ service: "api", sink: () => {} }),
      mcp: {},
      rateLimiter: false,
    });
    expect(
      (await app.request("/.well-known/oauth-protected-resource")).status,
    ).toBe(503);
    const response = await app.request("/mcp", rpc("1", "initialize"));
    expect(response.status).toBe(503);
  });
});
