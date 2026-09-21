import { createHash } from "node:crypto";

import { DEFAULT_LOCALHOST_SITE_URL } from "@arlequins/env/public-defaults";
import { serverEnv } from "@arlequins/env/server-env";
import type { Logger } from "@arlequins/logger";
import { type OpenAPIHono, z } from "@hono/zod-openapi";
import sharp from "sharp";

import type { ApiBindings } from "./app";
import type { GourmetPort } from "./features/gourmet/application/ports";
import type { GourmetInput } from "./features/gourmet/domain/models";

const MCP_PROTOCOL_VERSIONS = [
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
] as const;
const MCP_SERVER_VERSION = "1.0.0";
const MCP_SCOPE_READ = "gourmet:read";
const MCP_SCOPE_WRITE = "gourmet:write";
const MAX_SOURCE_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_TOTAL_SOURCE_IMAGE_BYTES = 30 * 1024 * 1024;
const MAX_IMPORTED_IMAGES = 6;
const MAX_OPTIMIZED_IMAGE_BYTES = 700 * 1024;
const TRUSTED_OPENAI_FILE_HOST = "files.oaiusercontent.com";

type McpPrincipal = {
  email: string;
  scopes?: string[];
  subject: string;
};

type McpJsonRpcRequest = {
  id?: number | string | null;
  jsonrpc?: string;
  method?: string;
  params?: Record<string, unknown>;
};

type McpJsonRpcResponse = {
  id: number | string | null;
  jsonrpc: "2.0";
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

const mcpRecordSchema = z
  .object({
    area: z.string().trim().min(1).max(120).nullable().optional().default(null),
    cookingMethods: z
      .array(z.string().trim().min(1).max(120))
      .max(24)
      .default([]),
    cuisineTags: z.array(z.string().trim().min(1).max(120)).max(24).default([]),
    discoveries: z.array(z.string().trim().min(1).max(120)).max(24).default([]),
    externalRequestId: z.string().trim().min(1).max(128).nullable().optional(),
    freeTextNote: z
      .string()
      .trim()
      .max(2_000)
      .nullable()
      .optional()
      .default(null),
    ingredients: z.array(z.string().trim().min(1).max(120)).max(24).default([]),
    liked: z.array(z.string().trim().min(1).max(120)).max(24).default([]),
    menuName: z.string().trim().min(1).max(200),
    nutritionTags: z
      .array(z.string().trim().min(1).max(120))
      .max(24)
      .default([]),
    postMealNotes: z
      .array(z.string().trim().min(1).max(120))
      .max(24)
      .default([]),
    rating: z
      .number()
      .min(0)
      .max(10)
      .refine(
        (value) => Number.isInteger(value * 2),
        "rating must use 0.5 increments",
      ),
    restaurantBranch: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .nullable()
      .optional()
      .default(null),
    restaurantName: z.string().trim().min(1).max(200),
    revisit: z.enum(["yes", "no", "unknown"]),
    summary: z.string().trim().min(1).max(500),
    tasteNotes: z.array(z.string().trim().min(1).max(120)).max(24).default([]),
    visitedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional()
      .default(null),
  })
  .strict();

const previewSchema = z
  .object({
    entries: z.array(mcpRecordSchema).min(1).max(24),
    sourceConversation: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

const openAIFileSchema = z
  .object({
    download_url: z.string().url().max(4_096),
    file_id: z.string().min(1).max(512),
    file_name: z.string().max(255).optional(),
    mime_type: z.string().max(120).optional(),
  })
  .strict();

const confirmSchema = previewSchema
  .extend({
    confirmed: z.literal(true),
    imageEntryIndexes: z
      .array(z.number().int().min(0).max(23))
      .max(6)
      .optional(),
    images: z.array(openAIFileSchema).max(MAX_IMPORTED_IMAGES).optional(),
  })
  .strict()
  .superRefine((input, context) => {
    const images = input.images ?? [];
    const indexes = input.imageEntryIndexes;
    if (indexes && indexes.length !== images.length)
      context.addIssue({
        code: "custom",
        message: "imageEntryIndexes must match the number of images",
        path: ["imageEntryIndexes"],
      });
    if (images.length > 0 && input.entries.length > 1 && !indexes)
      context.addIssue({
        code: "custom",
        message: "imageEntryIndexes is required when importing multiple meals",
        path: ["imageEntryIndexes"],
      });
    if (indexes?.some((index) => index >= input.entries.length))
      context.addIssue({
        code: "custom",
        message: "imageEntryIndexes must refer to an imported meal",
        path: ["imageEntryIndexes"],
      });
    if (!images.length && indexes?.length)
      context.addIssue({
        code: "custom",
        message: "imageEntryIndexes requires images",
        path: ["imageEntryIndexes"],
      });
  });

const toolRecordJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["restaurantName", "menuName", "rating", "revisit", "summary"],
  properties: {
    restaurantName: { type: "string", minLength: 1, maxLength: 200 },
    restaurantBranch: { type: ["string", "null"], maxLength: 120 },
    menuName: { type: "string", minLength: 1, maxLength: 200 },
    area: { type: ["string", "null"], maxLength: 120 },
    visitedAt: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    rating: { type: "number", minimum: 0, maximum: 10, multipleOf: 0.5 },
    revisit: { type: "string", enum: ["yes", "no", "unknown"] },
    summary: { type: "string", minLength: 1, maxLength: 500 },
    cookingMethods: { type: "array", maxItems: 24, items: { type: "string" } },
    cuisineTags: { type: "array", maxItems: 24, items: { type: "string" } },
    discoveries: { type: "array", maxItems: 24, items: { type: "string" } },
    externalRequestId: { type: ["string", "null"], maxLength: 128 },
    freeTextNote: { type: ["string", "null"], maxLength: 2_000 },
    ingredients: { type: "array", maxItems: 24, items: { type: "string" } },
    liked: { type: "array", maxItems: 24, items: { type: "string" } },
    nutritionTags: { type: "array", maxItems: 24, items: { type: "string" } },
    postMealNotes: { type: "array", maxItems: 24, items: { type: "string" } },
    tasteNotes: { type: "array", maxItems: 24, items: { type: "string" } },
  },
} as const;

const toolFileJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["download_url", "file_id"],
  properties: {
    download_url: { type: "string", format: "uri", maxLength: 4_096 },
    file_id: { type: "string", minLength: 1, maxLength: 512 },
    mime_type: { type: "string", maxLength: 120 },
    file_name: { type: "string", maxLength: 255 },
  },
} as const;

function validateOpenAIFileUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  const trustedHost = url.hostname === TRUSTED_OPENAI_FILE_HOST;
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    !trustedHost
  )
    throw new Error("Untrusted ChatGPT file download URL");
  return url;
}

async function readBoundedResponse(response: Response, maximumBytes: number) {
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > maximumBytes)
    throw new Error("ChatGPT image is too large");
  if (!response.body) throw new Error("ChatGPT image has no content");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel();
      throw new Error("ChatGPT image is too large");
    }
    chunks.push(value);
  }
  if (!total) throw new Error("ChatGPT image has no content");
  return Buffer.concat(chunks, total);
}

async function downloadOpenAIFile(
  file: z.infer<typeof openAIFileSchema>,
  remainingSourceBytes: number,
) {
  const maximumBytes = Math.min(MAX_SOURCE_IMAGE_BYTES, remainingSourceBytes);
  if (maximumBytes <= 0)
    throw new Error("Total ChatGPT image size is too large");
  let url = validateOpenAIFileUrl(file.download_url);
  for (let redirectCount = 0; redirectCount <= 2; redirectCount += 1) {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      const location = response.headers.get("location");
      if (!location || redirectCount === 2)
        throw new Error("ChatGPT image redirect is invalid");
      url = validateOpenAIFileUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new Error("ChatGPT image download failed");
    return readBoundedResponse(response, maximumBytes);
  }
  throw new Error("ChatGPT image download failed");
}

async function optimizeImportedImage(
  file: z.infer<typeof openAIFileSchema>,
  remainingSourceBytes: number,
) {
  const input = await downloadOpenAIFile(file, remainingSourceBytes);
  const source = sharp(input, {
    failOn: "error",
    limitInputPixels: 40_000_000,
  });
  const metadata = await source.metadata();
  if (!metadata.width || !metadata.height)
    throw new Error("ChatGPT file is not a supported image");
  if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format))
    throw new Error("Only JPEG, PNG, and WebP images are supported");

  let longestEdge = 1_600;
  let quality = 84;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const output = await sharp(input, {
      failOn: "error",
      limitInputPixels: 40_000_000,
    })
      .rotate()
      .resize({
        fit: "inside",
        height: longestEdge,
        withoutEnlargement: true,
        width: longestEdge,
      })
      .webp({ effort: 4, quality })
      .toBuffer();
    if (output.byteLength <= MAX_OPTIMIZED_IMAGE_BYTES) {
      const baseName = (file.file_name ?? "meal")
        .split(/[\\/]/)
        .at(-1)
        ?.replace(/\.[^.]*$/, "")
        .replace(/[^\p{L}\p{N}._ -]/gu, "")
        .trim()
        .slice(0, 200);
      return {
        altText: "식사 사진",
        contentBase64: output.toString("base64"),
        contentType: "image/webp" as const,
        originalFilename: `${baseName || "meal"}.webp`,
        sourceBytes: input.byteLength,
      };
    }
    quality = Math.max(50, quality - 6);
    if (attempt % 3 === 2) longestEdge = Math.floor(longestEdge * 0.8);
  }
  throw new Error("ChatGPT image could not be optimized to a safe size");
}

function bearer(value: string | undefined) {
  return value ? /^Bearer\s+(\S+)$/i.exec(value.trim())?.[1] : undefined;
}

function jsonRpcError(
  id: number | string | null,
  code: number,
  message: string,
): McpJsonRpcResponse {
  return { error: { code, message }, id, jsonrpc: "2.0" };
}

function jsonRpcResult(
  id: number | string | null,
  result: unknown,
): McpJsonRpcResponse {
  return { id, jsonrpc: "2.0", result };
}

function textResult(value: unknown, structuredContent = value) {
  return {
    content: [{ type: "text", text: JSON.stringify(value) }],
    structuredContent,
  };
}

function resourceFor(options: { resource?: string }) {
  return options.resource ?? serverEnv.BEAT_MCP_RESOURCE;
}

function issuerFor(options: { issuer?: string }) {
  return (options.issuer ?? serverEnv.BEAT_AUTH_ISSUER_URL)?.replace(/\/$/, "");
}

function metadataUrl(requestUrl: string) {
  return `${new URL(requestUrl).origin}/.well-known/oauth-protected-resource/mcp`;
}

function scopesFor(principal: McpPrincipal, required: string) {
  return (principal.scopes ?? []).includes(required);
}

function oauthChallenge(
  requestUrl: string,
  error: "insufficient_scope" | "invalid_token",
  description: string,
  scope = MCP_SCOPE_READ,
) {
  return `Bearer resource_metadata="${metadataUrl(requestUrl)}", error="${error}", error_description="${description}", scope="${scope}"`;
}

function oauthToolError(
  id: number | string | null,
  requestUrl: string,
  error: "insufficient_scope" | "invalid_token",
  description: string,
  scope = MCP_SCOPE_READ,
) {
  return jsonRpcResult(id, {
    _meta: {
      "mcp/www_authenticate": [
        oauthChallenge(requestUrl, error, description, scope),
      ],
    },
    content: [{ type: "text", text: description }],
    isError: true,
  });
}

function idempotencyKey(
  entry: GourmetInput,
  sourceConversation: string | undefined,
  occurrence: number,
) {
  const digest = createHash("sha256")
    .update(JSON.stringify({ entry, occurrence, sourceConversation }))
    .digest("hex");
  return `mcp:${digest}`;
}

function detailUrl(entry: { slug: string }) {
  return new URL(
    `gourmet/?entry=${encodeURIComponent(entry.slug)}`,
    `${(serverEnv.NEXT_PUBLIC_SITE_URL ?? DEFAULT_LOCALHOST_SITE_URL).replace(/\/$/, "")}/`,
  ).toString();
}

function tools() {
  return [
    {
      annotations: { openWorldHint: false, readOnlyHint: true },
      description:
        "Read recent Beat Gourmet records so historical records can be deduplicated before import.",
      inputSchema: {
        additionalProperties: false,
        properties: {
          days: { default: 365, maximum: 3650, minimum: 1, type: "integer" },
          limit: { default: 100, maximum: 100, minimum: 1, type: "integer" },
        },
        type: "object",
      },
      name: "gourmet_get_context",
      securitySchemes: [{ scopes: [MCP_SCOPE_READ], type: "oauth2" }],
    },
    {
      annotations: { openWorldHint: false, readOnlyHint: true },
      description:
        "Preview structured meal records extracted from the current ChatGPT context. Nothing is written.",
      inputSchema: {
        additionalProperties: false,
        properties: {
          entries: {
            items: toolRecordJsonSchema,
            maxItems: 24,
            minItems: 1,
            type: "array",
          },
          sourceConversation: { maxLength: 200, type: "string" },
        },
        required: ["entries"],
        type: "object",
      },
      name: "gourmet_preview_import",
      securitySchemes: [{ scopes: [MCP_SCOPE_READ], type: "oauth2" }],
    },
    {
      annotations: {
        destructiveHint: false,
        openWorldHint: false,
        readOnlyHint: false,
      },
      description:
        "Save meal records and any attached ChatGPT images as Beat Gourmet drafts. Call only when the user has asked to save or import the meal; never publish. If the meal details are uncertain, preview them first and wait for the user's confirmation.",
      inputSchema: {
        additionalProperties: false,
        properties: {
          confirmed: { const: true, type: "boolean" },
          entries: {
            items: toolRecordJsonSchema,
            maxItems: 24,
            minItems: 1,
            type: "array",
          },
          imageEntryIndexes: {
            items: { maximum: 23, minimum: 0, type: "integer" },
            maxItems: MAX_IMPORTED_IMAGES,
            type: "array",
          },
          images: {
            items: toolFileJsonSchema,
            maxItems: MAX_IMPORTED_IMAGES,
            type: "array",
          },
          sourceConversation: { maxLength: 200, type: "string" },
        },
        required: ["confirmed", "entries"],
        type: "object",
      },
      _meta: { "openai/fileParams": ["images"] },
      name: "gourmet_confirm_import",
      securitySchemes: [{ scopes: [MCP_SCOPE_WRITE], type: "oauth2" }],
    },
  ];
}

export function registerMcpRoutes(
  app: OpenAPIHono<ApiBindings>,
  options: {
    gourmet: GourmetPort;
    issuer?: string;
    logger?: Logger;
    resource?: string;
    verifyAccessTokenForAudience: (
      token: string,
      audience: string,
      requiredScopes?: string[],
    ) => Promise<McpPrincipal>;
  },
) {
  const resource = resourceFor(options);
  const issuer = issuerFor(options);
  const gourmet = options.gourmet;
  const log = options.logger;

  app.get("/.well-known/oauth-protected-resource", (context) => {
    if (!resource || !issuer)
      return context.json(
        { error: "MCP authentication is not configured" },
        503,
      );
    context.header("Cache-Control", "public, max-age=300");
    return context.json({
      authorization_servers: [issuer],
      resource,
      scopes_supported: [MCP_SCOPE_READ, MCP_SCOPE_WRITE],
    });
  });
  app.get("/.well-known/oauth-protected-resource/mcp", (context) => {
    if (!resource || !issuer)
      return context.json(
        { error: "MCP authentication is not configured" },
        503,
      );
    context.header("Cache-Control", "public, max-age=300");
    return context.json({
      authorization_servers: [issuer],
      resource,
      scopes_supported: [MCP_SCOPE_READ, MCP_SCOPE_WRITE],
    });
  });
  app.get("/mcp/.well-known/oauth-protected-resource", (context) => {
    if (!resource || !issuer)
      return context.json(
        { error: "MCP authentication is not configured" },
        503,
      );
    context.header("Cache-Control", "public, max-age=300");
    return context.json({
      authorization_servers: [issuer],
      resource,
      scopes_supported: [MCP_SCOPE_READ, MCP_SCOPE_WRITE],
    });
  });

  app.post("/mcp", async (context) => {
    const request = (await context.req.json().catch(() => undefined)) as
      | McpJsonRpcRequest
      | undefined;
    const id = request?.id ?? null;
    if (request?.jsonrpc !== "2.0" || typeof request.method !== "string")
      return context.json(
        jsonRpcError(id, -32600, "Invalid JSON-RPC request"),
        400,
      );
    const requestedHeader = context.req.header("MCP-Protocol-Version");
    if (
      requestedHeader &&
      !MCP_PROTOCOL_VERSIONS.includes(
        requestedHeader as (typeof MCP_PROTOCOL_VERSIONS)[number],
      )
    )
      return context.json(
        jsonRpcError(id, -32600, "Unsupported MCP protocol version"),
        400,
      );
    context.header(
      "MCP-Protocol-Version",
      requestedHeader ?? MCP_PROTOCOL_VERSIONS[0],
    );
    if (!resource || !issuer || !gourmet)
      return context.json(
        jsonRpcError(id, -32000, "MCP is not configured"),
        503,
      );

    if (request.method === "notifications/initialized")
      return context.body(null, 202);
    if (request.method === "initialize") {
      const requested = request.params?.protocolVersion;
      const protocolVersion =
        typeof requested === "string" &&
        MCP_PROTOCOL_VERSIONS.includes(
          requested as (typeof MCP_PROTOCOL_VERSIONS)[number],
        )
          ? requested
          : MCP_PROTOCOL_VERSIONS[0];
      context.header("MCP-Protocol-Version", protocolVersion);
      return context.json(
        jsonRpcResult(id, {
          capabilities: { tools: { listChanged: false } },
          instructions:
            "Use gourmet_preview_import first. Only call gourmet_confirm_import after the user explicitly confirms the complete preview.",
          protocolVersion,
          serverInfo: { name: "beat-gourmet", version: MCP_SERVER_VERSION },
        }),
      );
    }

    const token = bearer(context.req.header("authorization"));
    let principal: McpPrincipal;
    try {
      if (!token) throw new Error("missing_token");
      principal = await options.verifyAccessTokenForAudience(token, resource);
    } catch {
      if (request.method === "tools/call")
        return context.json(
          oauthToolError(
            id,
            context.req.url,
            "invalid_token",
            "Authentication is required before calling this tool.",
          ),
          200,
        );
      context.header(
        "WWW-Authenticate",
        oauthChallenge(
          context.req.url,
          "invalid_token",
          "Authentication is required before listing tools.",
        ),
      );
      return context.json(
        jsonRpcError(id, -32001, "OAuth authorization is required"),
        401,
      );
    }

    if (request.method === "tools/list")
      return context.json(jsonRpcResult(id, { tools: tools() }));
    if (request.method !== "tools/call")
      return context.json(jsonRpcError(id, -32601, "Method not found"), 404);

    const params = request.params ?? {};
    const name = typeof params.name === "string" ? params.name : undefined;
    const rawArguments = params.arguments;
    if (!name || !rawArguments || typeof rawArguments !== "object")
      return context.json(
        jsonRpcError(id, -32602, "Invalid tool arguments"),
        400,
      );

    try {
      if (name === "gourmet_get_context") {
        if (!scopesFor(principal, MCP_SCOPE_READ))
          return context.json(
            oauthToolError(
              id,
              context.req.url,
              "insufficient_scope",
              "gourmet:read scope is required.",
            ),
            200,
          );
        const input = z
          .object({
            days: z.number().int().min(1).max(3650).default(365),
            limit: z.number().int().min(1).max(100).default(100),
          })
          .parse(rawArguments);
        const result = await gourmet.context(input);
        return context.json(jsonRpcResult(id, textResult(result)));
      }

      if (name === "gourmet_preview_import") {
        if (!scopesFor(principal, MCP_SCOPE_READ))
          return context.json(
            oauthToolError(
              id,
              context.req.url,
              "insufficient_scope",
              "gourmet:read scope is required.",
            ),
            200,
          );
        const input = previewSchema.parse(rawArguments);
        const result = {
          count: input.entries.length,
          entries: input.entries,
          requiresConfirmation: true,
          sourceConversation: input.sourceConversation ?? null,
          status: "preview",
        };
        return context.json(jsonRpcResult(id, textResult(result)));
      }

      if (name === "gourmet_confirm_import") {
        if (!scopesFor(principal, MCP_SCOPE_WRITE))
          return context.json(
            oauthToolError(
              id,
              context.req.url,
              "insufficient_scope",
              "gourmet:write scope is required.",
              MCP_SCOPE_WRITE,
            ),
            200,
          );
        const input = confirmSchema.parse(rawArguments);
        const images: Array<{
          entryIndex: number;
          input: Omit<
            Awaited<ReturnType<typeof optimizeImportedImage>>,
            "sourceBytes"
          >;
        }> = [];
        let totalSourceBytes = 0;
        const imageEntryIndexes =
          input.imageEntryIndexes ?? (input.images ?? []).map(() => 0);
        for (const [index, file] of (input.images ?? []).entries()) {
          const image = await optimizeImportedImage(
            file,
            MAX_TOTAL_SOURCE_IMAGE_BYTES - totalSourceBytes,
          );
          totalSourceBytes += image.sourceBytes;
          const { sourceBytes: _sourceBytes, ...imageInput } = image;
          images.push({
            entryIndex: imageEntryIndexes[index] ?? 0,
            input: imageInput,
          });
        }

        const entryOccurrences = new Map<string, number>();
        const importedEntries = await Promise.all(
          input.entries.map(async (entry) => {
            const identity = JSON.stringify(entry);
            const occurrence = entryOccurrences.get(identity) ?? 0;
            entryOccurrences.set(identity, occurrence + 1);
            const idempotency = idempotencyKey(
              entry as GourmetInput,
              input.sourceConversation,
              occurrence,
            );
            const created = await gourmet.create(
              {
                ...(entry as GourmetInput),
                externalRequestId: idempotency,
                source: "chatgpt",
                status: "draft",
              },
              { idempotencyKey: idempotency, subject: principal.subject },
            );
            return { detailUrl: detailUrl(created), entry: created };
          }),
        );
        for (const image of images) {
          const imported = importedEntries[image.entryIndex];
          if (!imported) throw new Error("Image meal mapping is invalid");
          const attached = await gourmet.attachImage(
            imported.entry.id,
            {
              ...image.input,
              altText: `${imported.entry.restaurantName} ${imported.entry.menuName}`,
            },
            principal.subject,
          );
          importedEntries[image.entryIndex] = {
            detailUrl: detailUrl(attached),
            entry: attached,
          };
        }
        log?.info("mcp.gourmet.imported", {
          count: importedEntries.length,
          imageCount: images.length,
          subject: principal.subject,
        });
        return context.json(
          jsonRpcResult(
            id,
            textResult({
              count: importedEntries.length,
              entries: importedEntries,
              imageCount: images.length,
              status: "saved",
            }),
          ),
        );
      }

      return context.json(jsonRpcError(id, -32601, "Tool not found"), 404);
    } catch (error) {
      if (error instanceof z.ZodError)
        return context.json(
          jsonRpcError(id, -32602, "Invalid tool arguments"),
          200,
        );
      return context.json(
        jsonRpcError(id, -32000, "Tool execution failed"),
        200,
      );
    }
  });
}
