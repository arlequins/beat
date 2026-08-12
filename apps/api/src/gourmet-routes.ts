import { timingSafeEqual } from "node:crypto";

import { DEFAULT_LOCALHOST_SITE_URL } from "@acme/env/public-defaults";
import { serverEnv } from "@acme/env/server-env";
import type { Logger } from "@acme/logger";
import { type OpenAPIHono, z } from "@hono/zod-openapi";

import type { ApiBindings } from "./app";
import {
  attachGourmetImage,
  createGourmetEntry,
  deleteGourmetEntry,
  GourmetError,
  type GourmetInput,
  type GourmetListFilter,
  getGourmetEntry,
  gourmetContext,
  listGourmetEntries,
  updateGourmetEntry,
} from "./gourmet";

type Administrator = { subject: string };
type GourmetPort = {
  attachImage: typeof attachGourmetImage;
  context: typeof gourmetContext;
  create: typeof createGourmetEntry;
  delete: typeof deleteGourmetEntry;
  get: typeof getGourmetEntry;
  list: typeof listGourmetEntries;
  update: typeof updateGourmetEntry;
};

const tags = z.array(z.string().trim().min(1).max(120)).max(24).default([]);
const optionalText = z
  .string()
  .trim()
  .max(2_000)
  .nullable()
  .optional()
  .default(null);
const inputSchema = z
  .object({
    area: z.string().trim().min(1).max(120).nullable().optional().default(null),
    cookingMethods: tags,
    cuisineTags: tags,
    discoveries: tags,
    externalRequestId: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .nullable()
      .optional()
      .default(null),
    freeTextNote: optionalText,
    ingredients: tags,
    liked: tags,
    menuName: z.string().trim().min(1).max(200),
    nutritionTags: tags,
    postMealNotes: tags,
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
    source: z.enum(["chatgpt", "manual", "import"]).default("chatgpt"),
    status: z.enum(["draft", "published"]).default("published"),
    summary: z.string().trim().min(1).max(500),
    tasteNotes: tags,
    visitedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional()
      .default(null),
  })
  .strict();

const patchSchema = inputSchema
  .partial()
  .extend({ expectedRevision: z.number().int().positive().optional() })
  .strict();
const attachSchema = z
  .object({
    altText: z.string().trim().min(1).max(300),
    contentBase64: z.string().min(4).max(1_100_000),
    contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    originalFilename: z.string().trim().min(1).max(255),
  })
  .strict();
const optionalQueryNumber = (schema: z.ZodNumber) =>
  z.preprocess(
    (value) =>
      value === undefined || value === "" ? undefined : Number(value),
    schema.optional(),
  );
const filterSchema = z.object({
  area: z.string().trim().min(1).max(120).optional(),
  cuisineTag: z.string().trim().min(1).max(120).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  ingredient: z.string().trim().min(1).max(120).optional(),
  minRating: optionalQueryNumber(z.number().min(0).max(10)),
  page: optionalQueryNumber(z.number().int().positive()),
  pageSize: optionalQueryNumber(z.number().int().min(1).max(100)),
  restaurantName: z.string().trim().min(1).max(200).optional(),
  revisit: z.enum(["yes", "no", "unknown"]).optional(),
  status: z.enum(["draft", "published", "deleted"]).optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
const contextSchema = z.object({
  days: optionalQueryNumber(z.number().int().min(1).max(365)).default(30),
  limit: optionalQueryNumber(z.number().int().min(1).max(50)).default(30),
});

function bearer(authorization: string | undefined) {
  return authorization
    ? /^Bearer\s+(\S+)$/i.exec(authorization.trim())?.[1]
    : undefined;
}

function matchesActionKey(
  token: string | undefined,
  expected: string | undefined,
) {
  if (!token || !expected) return false;
  const left = Buffer.from(token);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function errorResponse(
  context: {
    get: (key: "requestId") => string;
    json: (
      body: unknown,
      status: 400 | 401 | 403 | 404 | 409 | 413 | 500,
    ) => Response;
  },
  error: unknown,
) {
  const requestId = context.get("requestId");
  if (error instanceof GourmetError) {
    const status =
      error.code === "not_found" || error.code === "image_not_found"
        ? 404
        : error.code === "conflict"
          ? 409
          : error.code === "storage_unavailable"
            ? 500
            : 400;
    return context.json(
      {
        error: {
          code: error.code.toUpperCase(),
          message: error.message,
          requestId,
        },
      },
      status,
    );
  }
  if (error instanceof z.ZodError)
    return context.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: "Request fields are invalid",
          requestId,
        },
      },
      400,
    );
  return undefined;
}

function filters(url: URL): GourmetListFilter {
  return filterSchema.parse(
    Object.fromEntries(url.searchParams),
  ) as GourmetListFilter;
}

export function registerGourmetRoutes(
  app: OpenAPIHono<ApiBindings>,
  options: {
    actionApiKey?: string;
    gourmet?: GourmetPort;
    verifyAccessToken: (token: string) => Promise<Administrator>;
  },
) {
  const gourmet: GourmetPort = options.gourmet ?? {
    attachImage: attachGourmetImage,
    context: gourmetContext,
    create: createGourmetEntry,
    delete: deleteGourmetEntry,
    get: getGourmetEntry,
    list: listGourmetEntries,
    update: updateGourmetEntry,
  };
  const principal = async (context: {
    req: { header: (name: string) => string | undefined };
  }) => {
    const token = bearer(context.req.header("authorization"));
    if (
      matchesActionKey(
        token,
        options.actionApiKey ?? serverEnv.BEAT_GOURMET_ACTION_API_KEY,
      )
    )
      return { kind: "action" as const, subject: "chatgpt-action" };
    if (!token) return undefined;
    try {
      return {
        kind: "admin" as const,
        subject: (await options.verifyAccessToken(token)).subject,
      };
    } catch {
      return undefined;
    }
  };
  const invalid = (context: Parameters<typeof errorResponse>[0]) =>
    context.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: "Request fields are invalid",
          requestId: context.get("requestId"),
        },
      },
      400,
    );
  const log = (
    context: { get: (key: "logger") => Logger },
    name: string,
    details: Record<string, unknown>,
  ) => context.get("logger").info(name, details);

  app.get("/api/gourmet/entries", async (context) => {
    try {
      const filter = filters(new URL(context.req.url));
      const user = await principal(context);
      if (filter.status && filter.status !== "published" && !user)
        return context.json(
          {
            error: {
              code: "FORBIDDEN",
              message: "Administrator authentication is required",
              requestId: context.get("requestId"),
            },
          },
          403,
        );
      return context.json(
        await gourmet.list({
          ...filter,
          status: user ? filter.status : "published",
        }),
      );
    } catch (error) {
      return (
        errorResponse(context, error) ??
        context.json(
          {
            error: {
              code: "INTERNAL",
              message: "Unable to list gourmet entries",
              requestId: context.get("requestId"),
            },
          },
          500,
        )
      );
    }
  });

  app.post("/api/gourmet/entries", async (context) => {
    const user = await principal(context);
    if (!user)
      return context.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Bearer authentication is required",
            requestId: context.get("requestId"),
          },
        },
        401,
      );
    try {
      const input = inputSchema.parse(await context.req.json()) as GourmetInput;
      const idempotencyKey =
        context.req.header("idempotency-key") ??
        input.externalRequestId ??
        undefined;
      const entry = await gourmet.create(input, {
        idempotencyKey,
        subject: user.subject,
      });
      log(context, "gourmet.created", {
        id: entry.id,
        requestId: context.get("requestId"),
        source: entry.source,
      });
      return context.json(
        {
          detailUrl: new URL(
            `gourmet/?entry=${encodeURIComponent(entry.slug)}`,
            `${(serverEnv.NEXT_PUBLIC_SITE_URL ?? DEFAULT_LOCALHOST_SITE_URL).replace(/\/$/, "")}/`,
          ).toString(),
          entry,
          status: "saved",
        },
        201,
      );
    } catch (error) {
      return errorResponse(context, error) ?? invalid(context);
    }
  });

  app.get("/api/gourmet/context", async (context) => {
    const user = await principal(context);
    if (!user)
      return context.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Bearer authentication is required",
            requestId: context.get("requestId"),
          },
        },
        401,
      );
    try {
      const { days, limit } = contextSchema.parse(
        Object.fromEntries(new URL(context.req.url).searchParams),
      );
      return context.json(await gourmet.context({ days, limit }));
    } catch (error) {
      return (
        errorResponse(context, error) ??
        context.json(
          {
            error: {
              code: "INTERNAL",
              message: "Unable to create gourmet context",
              requestId: context.get("requestId"),
            },
          },
          500,
        )
      );
    }
  });

  app.get("/api/gourmet/entries/:id", async (context) => {
    try {
      const result = await gourmet.get(context.req.param("id"));
      if (
        !result ||
        (result.entry.status !== "published" && !(await principal(context)))
      )
        return context.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "Gourmet entry was not found",
              requestId: context.get("requestId"),
            },
          },
          404,
        );
      return context.json(result.entry);
    } catch (error) {
      return (
        errorResponse(context, error) ??
        context.json(
          {
            error: {
              code: "INTERNAL",
              message: "Unable to load gourmet entry",
              requestId: context.get("requestId"),
            },
          },
          500,
        )
      );
    }
  });

  app.patch("/api/gourmet/entries/:id", async (context) => {
    const user = await principal(context);
    if (!user)
      return context.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Bearer authentication is required",
            requestId: context.get("requestId"),
          },
        },
        401,
      );
    try {
      const entry = await gourmet.update(
        context.req.param("id"),
        patchSchema.parse(await context.req.json()) as Partial<GourmetInput> & {
          expectedRevision?: number;
        },
        user.subject,
      );
      log(context, "gourmet.updated", {
        id: entry.id,
        requestId: context.get("requestId"),
      });
      return context.json(entry);
    } catch (error) {
      return errorResponse(context, error) ?? invalid(context);
    }
  });

  app.delete("/api/gourmet/entries/:id", async (context) => {
    const user = await principal(context);
    if (user?.kind !== "admin")
      return context.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Administrator authentication is required",
            requestId: context.get("requestId"),
          },
        },
        403,
      );
    try {
      return context.json(
        await gourmet.delete(context.req.param("id"), user.subject),
      );
    } catch (error) {
      return (
        errorResponse(context, error) ??
        context.json(
          {
            error: {
              code: "INTERNAL",
              message: "Unable to delete gourmet entry",
              requestId: context.get("requestId"),
            },
          },
          500,
        )
      );
    }
  });

  app.post("/admin/gourmet/entries/:id/images", async (context) => {
    const user = await principal(context);
    if (user?.kind !== "admin")
      return context.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Administrator authentication is required",
            requestId: context.get("requestId"),
          },
        },
        403,
      );
    try {
      return context.json(
        await gourmet.attachImage(
          context.req.param("id"),
          attachSchema.parse(await context.req.json()),
          user.subject,
        ),
      );
    } catch (error) {
      return errorResponse(context, error) ?? invalid(context);
    }
  });
}
