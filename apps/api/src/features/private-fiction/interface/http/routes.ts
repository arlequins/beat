import { type OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import type { ApiBindings } from "../../../../app";
import type { ActiveAdmin } from "../../../../beat-auth";
import { GOOGLE_ALLOWED_EMAIL } from "../../../../beat-google";
import type { PrivateFictionDocument } from "../../s3-private-fiction-repository";
import { PrivateFictionStorageError } from "../../s3-private-fiction-repository";

const saveSchema = z.object({
  expectedEtag: z.string().max(256).nullable(),
  source: z.string().min(1).max(750_000),
});

export type PrivateFictionPort = {
  get: () => Promise<PrivateFictionDocument | undefined>;
  save: (input: { expectedEtag: string | null; source: string }) => Promise<{
    etag: string;
    updatedAt: string;
  }>;
};

function bearer(value: string | undefined) {
  const match = value ? /^Bearer\s+(\S+)$/i.exec(value.trim()) : undefined;
  return match?.[1];
}

export function registerPrivateFictionRoutes(
  app: OpenAPIHono<ApiBindings>,
  options: {
    store: PrivateFictionPort;
    verifyAccessToken: (
      token: string,
    ) => Promise<Pick<ActiveAdmin, "email" | "subject">>;
  },
) {
  async function owner(context: Context<ApiBindings>) {
    const token = bearer(context.req.header("authorization"));
    if (!token)
      return { response: context.json({ error: "Unauthorized" }, 401) };
    try {
      const identity = await options.verifyAccessToken(token);
      // The signed Beat subject is the stable account ID. Its email is also
      // checked against Beat's sole configured Google account as defense in depth.
      if (
        !identity.subject.trim() ||
        identity.email.trim().toLowerCase() !== GOOGLE_ALLOWED_EMAIL
      )
        return { response: context.json({ error: "Not found" }, 404) };
      return { identity };
    } catch {
      return { response: context.json({ error: "Unauthorized" }, 401) };
    }
  }

  app.get("/admin/private-fiction", async (context) => {
    context.header("Cache-Control", "private, no-store, max-age=0");
    context.header("Vary", "Authorization");
    const access = await owner(context);
    if (access.response) return access.response;
    try {
      const document = await options.store.get();
      if (!document) return context.json({ error: "Not found" }, 404);
      return context.json(document);
    } catch {
      return context.json({ error: "Private manuscript unavailable" }, 503);
    }
  });

  app.put("/admin/private-fiction", async (context) => {
    context.header("Cache-Control", "private, no-store, max-age=0");
    context.header("Vary", "Authorization");
    const access = await owner(context);
    if (access.response) return access.response;
    const parsed = saveSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!parsed.success)
      return context.json({ error: "Invalid private manuscript" }, 400);
    if (new TextEncoder().encode(parsed.data.source).byteLength > 750_000)
      return context.json({ error: "Invalid private manuscript" }, 400);
    try {
      return context.json(await options.store.save(parsed.data));
    } catch (error) {
      if (
        error instanceof PrivateFictionStorageError &&
        error.code === "conflict"
      )
        return context.json(
          { error: "Manuscript changed; reload before saving" },
          409,
        );
      return context.json({ error: "Private manuscript unavailable" }, 503);
    }
  });
}
