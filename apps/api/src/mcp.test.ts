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
  const logs: unknown[] = [];
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
    logger: createLogger({
      service: "api",
      sink: (record) => logs.push(record),
    }),
    mcp: {
      issuer: "https://api.example.com/auth",
      resource: "https://api.example.com/mcp",
    },
    rateLimiter: false,
  });
  return { app, attachImage, context, create, logs };
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

async function smallPhoto(format: "png" | "gif" = "png") {
  return sharp({
    create: {
      background: { alpha: 1, b: 30, g: 120, r: 190 },
      channels: 3,
      height: 24,
      width: 24,
    },
  })
    .toFormat(format)
    .toBuffer();
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
      result: {
        isError: true,
        structuredContent: {
          error: {
            code: "IMAGE_TOO_LARGE",
            stage: "image_download",
            imageIndex: 0,
            requestId: expect.any(String),
          },
          saveState: "not_started",
          status: "failed",
        },
      },
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
    await expect(initialUrl.json()).resolves.toMatchObject({
      result: {
        isError: true,
        structuredContent: { error: { code: "IMAGE_URL_UNTRUSTED" } },
      },
    });

    const redirect = await confirmWithImages(app, {
      confirmed: true,
      entries: [record],
      images: [fileInput()],
    });
    expect(redirect.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
    await expect(redirect.json()).resolves.toMatchObject({
      result: {
        isError: true,
        structuredContent: { error: { code: "IMAGE_URL_UNTRUSTED" } },
      },
    });
  });

  it.each([
    [
      "https://unexpected-files.example",
      "unexpected-files.example",
      "hostname",
    ],
    [
      "https://sub.files.oaiusercontent.com",
      "sub.files.oaiusercontent.com",
      "hostname",
    ],
    [
      "https://files.oaiusercontent.com.attacker.example",
      "files.oaiusercontent.com.attacker.example",
      "hostname",
    ],
    [
      "https://UNEXPECTED-FILES.EXAMPLE",
      "unexpected-files.example",
      "hostname",
    ],
    ["https://bücher.example", "xn--bcher-kva.example", "hostname"],
    ["http://files.oaiusercontent.com", "files.oaiusercontent.com", "protocol"],
    [
      "https://private-user:private-password@files.oaiusercontent.com",
      "files.oaiusercontent.com",
      "credentials",
    ],
    [
      "https://files.oaiusercontent.com:8443",
      "files.oaiusercontent.com",
      "port",
    ],
  ])(
    "reports only a sanitized rejected hostname and reason for %s",
    async (origin, downloadHost, urlRejectionReason) => {
      const { app, create, attachImage, logs } = appHarness();
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const response = await confirmWithImages(app, {
        confirmed: true,
        entries: [{ ...record, summary: "private meal summary" }],
        images: [
          {
            ...fileInput(
              `${origin}/private-file-path?sig=private-signature#private-fragment`,
            ),
            file_id: "private-file-id",
            file_name: "private-photo-name.jpg",
          },
        ],
      });
      const body = await response.json();
      const error = body.result.structuredContent.error;
      expect(error).toMatchObject({
        code: "IMAGE_URL_UNTRUSTED",
        stage: "image_download",
        downloadHost,
        urlRejectionReason,
        imageIndex: 0,
      });
      expect(body.result.structuredContent.saveState).toBe("not_started");
      expect(fetchMock).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
      expect(attachImage).not.toHaveBeenCalled();
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: "mcp.gourmet.import_failed",
            downloadHost,
            urlRejectionReason,
            requestId: error.requestId,
          }),
        ]),
      );
      const diagnostics = JSON.stringify({ body, logs });
      for (const value of [
        "private-user",
        "private-password",
        "private-file-path",
        "private-signature",
        "private-fragment",
        "private-file-id",
        "private-photo-name.jpg",
        "private meal summary",
        ":8443",
      ])
        expect(diagnostics).not.toContain(value);
    },
  );

  it("reports a rejected redirect hostname without exposing either signed URL", async () => {
    const { app, create, logs } = appHarness();
    const fetchMock = vi.fn(
      async () =>
        new Response(null, {
          headers: {
            location:
              "https://redirect-files.example/private-target?sig=private-target-token",
          },
          status: 302,
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await confirmWithImages(app, {
      confirmed: true,
      entries: [record],
      images: [
        fileInput(
          "https://files.oaiusercontent.com/private-source?sig=private-source-token",
        ),
      ],
    });
    const body = await response.json();
    expect(body.result.structuredContent.error).toMatchObject({
      code: "IMAGE_URL_UNTRUSTED",
      downloadHost: "redirect-files.example",
      urlRejectionReason: "hostname",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
    const diagnostics = JSON.stringify({ body, logs });
    for (const value of [
      "private-target",
      "private-source",
      "files.oaiusercontent.com",
    ])
      expect(diagnostics).not.toContain(value);
  });

  it.each([
    "data:image/jpeg;base64,private-image-data",
    `https://${"a".repeat(254)}.example/private-file?sig=private-signature`,
    "https://unsafe_host.example/private-file?sig=private-signature",
  ])("omits unsafe or absent diagnostic hostnames for %s", async (url) => {
    const { app, create, logs } = appHarness();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await confirmWithImages(app, {
      confirmed: true,
      entries: [record],
      images: [fileInput(url)],
    });
    const body = await response.json();
    expect(body.result.structuredContent.error.code).toBe(
      "IMAGE_URL_UNTRUSTED",
    );
    expect(body.result.structuredContent.error).not.toHaveProperty(
      "downloadHost",
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    const diagnostics = JSON.stringify({ body, logs });
    for (const value of [
      "private-image-data",
      "private-file",
      "private-signature",
      "unsafe_host",
      "a".repeat(254),
    ])
      expect(diagnostics).not.toContain(value);
  });

  it("still accepts an uppercase spelling of the exact trusted hostname", async () => {
    const { app, create, attachImage } = appHarness();
    const photo = await smallPhoto();
    const fetchMock = vi.fn(async () => new Response(asArrayBuffer(photo)));
    vi.stubGlobal("fetch", fetchMock);
    const response = await confirmWithImages(app, {
      confirmed: true,
      entries: [record],
      images: [fileInput("https://FILES.OAIUSERCONTENT.COM/image")],
    });
    expect((await response.json()).result.structuredContent.status).toBe(
      "saved",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(attachImage).toHaveBeenCalledTimes(1);
  });

  it.each([
    "not-a-url/private-path?sig=private-signature",
    "https://[invalid-host/private-path?sig=private-signature",
  ])(
    "rejects malformed file URLs without exposing their contents",
    async (url) => {
      const { app, create, logs } = appHarness();
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const response = await confirmWithImages(app, {
        confirmed: true,
        entries: [record],
        images: [fileInput(url)],
      });
      const body = await response.json();
      expect(body.result.structuredContent.error.code).toBe(
        "IMAGE_INPUT_INVALID",
      );
      expect(body.result.structuredContent.error).not.toHaveProperty(
        "downloadHost",
      );
      expect(fetchMock).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
      const diagnostics = JSON.stringify({ body, logs });
      for (const value of ["private-path", "private-signature", "invalid-host"])
        expect(diagnostics).not.toContain(value);
    },
  );

  it.each([401, 403, 404, 410, 500])(
    "reports photo download HTTP %s without leaking file details",
    async (status) => {
      const { app, create, logs } = appHarness();
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("private response", { status })),
      );
      const response = await confirmWithImages(app, {
        confirmed: true,
        entries: [{ ...record, summary: "private meal summary" }],
        images: [
          {
            ...fileInput(
              "https://files.oaiusercontent.com/private-file?sig=secret-signature",
            ),
            file_id: "private-file-id",
            file_name: "private-photo-name.jpg",
          },
        ],
      });
      const body = await response.json();
      expect(body).toMatchObject({
        result: {
          isError: true,
          structuredContent: {
            error: {
              code:
                status === 500
                  ? "IMAGE_DOWNLOAD_FAILED"
                  : "IMAGE_DOWNLOAD_UNAVAILABLE",
              httpStatus: status,
              stage: "image_download",
              imageIndex: 0,
            },
            saveState: "not_started",
          },
        },
      });
      expect(create).not.toHaveBeenCalled();
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: "mcp.gourmet.import_failed",
            stage: "image_download",
            httpStatus: status,
            requestId: body.result.structuredContent.error.requestId,
          }),
        ]),
      );
      const diagnostics = JSON.stringify({ body, logs });
      for (const privateValue of [
        "private response",
        "private meal summary",
        "files.oaiusercontent.com",
        "secret-signature",
        "private-file-id",
        "private-photo-name.jpg",
      ])
        expect(diagnostics).not.toContain(privateValue);
    },
  );

  it.each([
    [new Error("private download URL or token"), "IMAGE_DOWNLOAD_FAILED"],
    [
      new DOMException("private timeout details", "TimeoutError"),
      "IMAGE_DOWNLOAD_TIMEOUT",
    ],
  ])("sanitizes download exceptions as %s", async (error, code) => {
    const { app, create, logs } = appHarness();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
    const response = await confirmWithImages(app, {
      confirmed: true,
      entries: [record],
      images: [fileInput()],
    });
    const body = await response.json();
    expect(body).toMatchObject({
      result: {
        isError: true,
        structuredContent: {
          error: { code, stage: "image_download" },
          saveState: "not_started",
        },
      },
    });
    expect(JSON.stringify({ body, logs })).not.toContain(error.message);
    expect(create).not.toHaveBeenCalled();
  });

  it.each(["invalid", "excessive"])(
    "reports %s photo redirects before saving",
    async (kind) => {
      const { app, create } = appHarness();
      const fetchMock = vi.fn(
        async () =>
          new Response(null, {
            status: 302,
            headers: {
              location:
                kind === "invalid"
                  ? "https://[invalid"
                  : "https://files.oaiusercontent.com/loop",
            },
          }),
      );
      vi.stubGlobal("fetch", fetchMock);
      const response = await confirmWithImages(app, {
        confirmed: true,
        entries: [record],
        images: [fileInput()],
      });
      await expect(response.json()).resolves.toMatchObject({
        result: {
          isError: true,
          structuredContent: {
            error: { code: "IMAGE_REDIRECT_INVALID" },
            saveState: "not_started",
          },
        },
      });
      expect(fetchMock).toHaveBeenCalledTimes(kind === "invalid" ? 1 : 3);
      expect(create).not.toHaveBeenCalled();
    },
  );

  it.each(["empty", "invalid", "unsupported"])(
    "reports %s photo content before saving",
    async (kind) => {
      const { app, create, attachImage } = appHarness();
      const bytes =
        kind === "unsupported"
          ? await smallPhoto("gif")
          : Buffer.from(kind === "empty" ? "" : "not image bytes");
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(asArrayBuffer(bytes))),
      );
      const response = await confirmWithImages(app, {
        confirmed: true,
        entries: [record],
        images: [fileInput()],
      });
      await expect(response.json()).resolves.toMatchObject({
        result: {
          isError: true,
          structuredContent: {
            error: {
              code:
                kind === "empty"
                  ? "IMAGE_EMPTY"
                  : kind === "invalid"
                    ? "IMAGE_PROCESSING_FAILED"
                    : "IMAGE_UNSUPPORTED_FORMAT",
              imageIndex: 0,
            },
            saveState: "not_started",
          },
        },
      });
      expect(create).not.toHaveBeenCalled();
      expect(attachImage).not.toHaveBeenCalled();
    },
  );

  it.each(["draft_save", "image_attachment"])(
    "reports %s failures as potentially partial and sanitizes storage errors",
    async (stage) => {
      const { app, create, attachImage, logs } = appHarness();
      const bytes = await smallPhoto();
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(asArrayBuffer(bytes))),
      );
      const privateError = new Error("private S3 key and credential");
      if (stage === "draft_save") create.mockRejectedValue(privateError);
      else attachImage.mockRejectedValue(privateError);
      const response = await confirmWithImages(app, {
        confirmed: true,
        entries: [record],
        images: [fileInput()],
      });
      const body = await response.json();
      expect(body).toMatchObject({
        result: {
          isError: true,
          structuredContent: {
            error: {
              code:
                stage === "draft_save"
                  ? "DRAFT_SAVE_FAILED"
                  : "IMAGE_ATTACHMENT_FAILED",
              stage,
            },
            saveState: "possibly_partial",
          },
        },
      });
      expect(body.result.structuredContent.error.message).toContain(
        "same meal details and source conversation",
      );
      expect(JSON.stringify({ body, logs })).not.toContain(
        privateError.message,
      );
      expect(create).toHaveBeenCalledTimes(1);
      expect(attachImage).toHaveBeenCalledTimes(stage === "draft_save" ? 0 : 1);
    },
  );

  it("identifies a second-photo download failure before creating any drafts", async () => {
    const { app, create, attachImage } = appHarness();
    const bytes = await smallPhoto();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(asArrayBuffer(bytes)))
        .mockResolvedValueOnce(
          new Response(
            new ReadableStream({
              start(controller) {
                controller.error(
                  new DOMException("private stream error", "TimeoutError"),
                );
              },
            }),
          ),
        ),
    );
    const response = await confirmWithImages(app, {
      confirmed: true,
      entries: [record],
      images: [fileInput(), { ...fileInput(), file_id: "file-2" }],
    });
    await expect(response.json()).resolves.toMatchObject({
      result: {
        isError: true,
        structuredContent: {
          error: {
            code: "IMAGE_DOWNLOAD_TIMEOUT",
            imageIndex: 1,
            stage: "image_download",
          },
          saveState: "not_started",
        },
      },
    });
    expect(create).not.toHaveBeenCalled();
    expect(attachImage).not.toHaveBeenCalled();
  });

  it("identifies a second-photo storage failure after the first attachment succeeds", async () => {
    const { app, create, attachImage } = appHarness();
    const bytes = await smallPhoto();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(asArrayBuffer(bytes))),
    );
    attachImage
      .mockResolvedValueOnce(entry)
      .mockRejectedValueOnce(new Error("private storage exception"));
    const response = await confirmWithImages(app, {
      confirmed: true,
      entries: [record],
      images: [fileInput(), { ...fileInput(), file_id: "file-2" }],
    });
    await expect(response.json()).resolves.toMatchObject({
      result: {
        isError: true,
        structuredContent: {
          error: {
            code: "IMAGE_ATTACHMENT_FAILED",
            imageIndex: 1,
            stage: "image_attachment",
          },
          saveState: "possibly_partial",
        },
      },
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(attachImage).toHaveBeenCalledTimes(2);
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
      result: {
        isError: true,
        structuredContent: {
          error: { code: "IMAGE_INPUT_INVALID", stage: "image_input" },
          saveState: "not_started",
        },
      },
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    { images: ["/private/photo.jpg"] },
    { images: ["file-123"] },
    {
      images: [
        { download_url: "https://files.oaiusercontent.com/private?sig=secret" },
      ],
    },
    { images: Array.from({ length: 7 }, () => fileInput()) },
  ])(
    "reports invalid file transport without saving or leaking the input (%#)",
    async ({ images }) => {
      const { app, create, attachImage, logs } = appHarness();
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const response = await confirmWithImages(app, {
        confirmed: true,
        entries: [record],
        images,
      });
      const body = await response.json();
      expect(body).toMatchObject({
        result: {
          isError: true,
          structuredContent: {
            error: { code: "IMAGE_INPUT_INVALID", stage: "image_input" },
            saveState: "not_started",
          },
        },
      });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
      expect(attachImage).not.toHaveBeenCalled();
      for (const value of ["/private/photo.jpg", "file-123", "sig=secret"])
        expect(JSON.stringify({ body, logs })).not.toContain(value);
    },
  );

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
