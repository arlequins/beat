import { createLogger } from "@arlequins/logger";
import sharp from "sharp";
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
  const create = vi.fn(
    async (
      input: Parameters<GourmetPort["create"]>[0],
      _options: Parameters<GourmetPort["create"]>[1],
    ) => ({ ...entry, ...input }),
  );
  const attachImage = vi.fn(
    async (
      entryId: string,
      _input: Parameters<GourmetPort["attachImage"]>[1],
      _subject: string,
    ) => ({ ...entry, id: entryId }),
  );
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
      attachImage,
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
  return { app, attachImage, context, create };
}

function asArrayBuffer(value: Uint8Array) {
  return value.buffer.slice(
    value.byteOffset,
    value.byteOffset + value.byteLength,
  ) as ArrayBuffer;
}

function fileInput(downloadUrl = "https://files.oaiusercontent.com/file-1") {
  return {
    download_url: downloadUrl,
    file_id: "file-1",
    file_name: "lunch.jpg",
    mime_type: "image/jpeg",
  };
}

async function confirmWithImages(
  app: ReturnType<typeof createApiApp>,
  arguments_: Record<string, unknown>,
  id = "image-confirm",
) {
  return app.request("/mcp", {
    ...rpc(id, "tools/call", {
      arguments: arguments_,
      name: "gourmet_confirm_import",
    }),
    headers: {
      Authorization: "Bearer mcp-token",
      "Content-Type": "application/json",
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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

  it("declares ChatGPT file parameters on the top-level images field", async () => {
    const { app } = appHarness();
    const listed = await app.request("/mcp", {
      ...rpc("files", "tools/list"),
      headers: {
        Authorization: "Bearer mcp-token",
        "Content-Type": "application/json",
      },
    });
    const body = await listed.json();
    const confirmTool = body.result.tools.find(
      (tool: { name: string }) => tool.name === "gourmet_confirm_import",
    );
    expect(confirmTool._meta["openai/fileParams"]).toEqual(["images"]);
    expect(confirmTool.inputSchema.properties.images.items.required).toEqual([
      "download_url",
      "file_id",
    ]);
    expect(
      confirmTool.inputSchema.properties.images.items.properties,
    ).toHaveProperty("mime_type");
    expect(
      confirmTool.inputSchema.properties.images.items.properties,
    ).toHaveProperty("file_name");
  });

  it("downloads an attached photo, normalizes it, and attaches it to the draft", async () => {
    const { app, attachImage, create } = appHarness();
    const source = await sharp({
      create: {
        background: { alpha: 1, b: 30, g: 120, r: 190 },
        channels: 3,
        height: 1_200,
        width: 2_400,
      },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const fetchMock = vi.fn(
      async () =>
        new Response(asArrayBuffer(source), {
          headers: {
            "content-length": String(source.byteLength),
            "content-type": "image/jpeg",
          },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await confirmWithImages(app, {
      confirmed: true,
      entries: [record],
      images: [fileInput()],
      sourceConversation: "conversation-1",
    });
    expect(response.status).toBe(200);
    expect(create).toHaveBeenCalledTimes(1);
    expect(attachImage).toHaveBeenCalledTimes(1);
    expect(attachImage).toHaveBeenCalledWith(
      "entry-1",
      expect.objectContaining({
        altText: "Example Tasting menu",
        contentType: "image/webp",
        originalFilename: "lunch.webp",
      }),
      "admin-1",
    );
    const normalized = attachImage.mock.calls[0]?.[1];
    expect(normalized).toBeDefined();
    if (!normalized) throw new Error("normalized photo was not attached");
    const metadata = await sharp(
      Buffer.from(normalized.contentBase64, "base64"),
    ).metadata();
    expect(metadata).toMatchObject({
      format: "webp",
      height: 1_600,
      width: 800,
    });
    expect(metadata.exif).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
    expect(
      Buffer.from(normalized.contentBase64, "base64").byteLength,
    ).toBeLessThan(700 * 1024);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://files.oaiusercontent.com/file-1"),
      expect.objectContaining({ redirect: "manual" }),
    );
  });

  it("reuses the same meal idempotency key when a photo import is retried", async () => {
    const { app, create } = appHarness();
    const source = await sharp({
      create: {
        background: { alpha: 1, b: 30, g: 120, r: 190 },
        channels: 3,
        height: 24,
        width: 24,
      },
    })
      .png()
      .toBuffer();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(asArrayBuffer(source), {
            headers: { "content-length": String(source.byteLength) },
          }),
      ),
    );
    const arguments_ = {
      confirmed: true,
      entries: [record],
      images: [fileInput()],
      sourceConversation: "retryable-conversation",
    };

    expect(
      (await confirmWithImages(app, arguments_, "first-write")).status,
    ).toBe(200);
    expect(
      (await confirmWithImages(app, arguments_, "retry-write")).status,
    ).toBe(200);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0]?.[1].idempotencyKey).toBe(
      create.mock.calls[1]?.[1].idempotencyKey,
    );
  });

  it("rejects an oversized file from its declared length before creating a draft", async () => {
    const { app, create } = appHarness();
    const fetchMock = vi.fn(
      async () =>
        new Response(null, {
          headers: { "content-length": String(12 * 1024 * 1024 + 1) },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await confirmWithImages(app, {
      confirmed: true,
      entries: [record],
      images: [fileInput()],
    });
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: { code: -32000 },
    });
  });

  it("rejects untrusted downloads and redirects before creating a draft", async () => {
    const { app, create } = appHarness();
    const fetchMock = vi.fn(
      async () =>
        new Response(null, {
          headers: { location: "https://attacker.example/image" },
          status: 302,
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const initialUrl = await confirmWithImages(app, {
      confirmed: true,
      entries: [record],
      images: [fileInput("https://attacker.example/image")],
    });
    expect(initialUrl.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();

    const redirect = await confirmWithImages(app, {
      confirmed: true,
      entries: [record],
      images: [fileInput()],
    });
    expect(redirect.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
  });

  it("requires an unambiguous photo-to-meal map before downloading files", async () => {
    const { app, create } = appHarness();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await confirmWithImages(app, {
      confirmed: true,
      entries: [record, { ...record, restaurantName: "Another place" }],
      images: [fileInput()],
    });
    await expect(response.json()).resolves.toMatchObject({
      error: { code: -32602 },
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("attaches each photo to its explicitly mapped meal", async () => {
    const { app, attachImage, create } = appHarness();
    create.mockImplementation(async (input) => ({
      ...entry,
      ...input,
      id: input.restaurantName === "Another place" ? "entry-2" : "entry-1",
      slug:
        input.restaurantName === "Another place"
          ? "another-entry"
          : "example-entry",
    }));
    const source = await sharp({
      create: {
        background: { alpha: 1, b: 30, g: 120, r: 190 },
        channels: 3,
        height: 24,
        width: 24,
      },
    })
      .png()
      .toBuffer();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(asArrayBuffer(source), {
            headers: { "content-length": String(source.byteLength) },
          }),
      ),
    );

    const response = await confirmWithImages(app, {
      confirmed: true,
      entries: [record, { ...record, restaurantName: "Another place" }],
      images: [
        fileInput(),
        { ...fileInput(), file_id: "file-2", file_name: "supper.jpg" },
      ],
      imageEntryIndexes: [1, 0],
    });
    expect(response.status).toBe(200);
    expect(
      attachImage.mock.calls.map(([entryId, input]) => [
        entryId,
        input.altText,
      ]),
    ).toEqual([
      ["entry-2", "Another place Tasting menu"],
      ["entry-1", "Example Tasting menu"],
    ]);
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
