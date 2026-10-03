import { createHash } from "node:crypto";
import { type OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import type { ApiBindings } from "../../../../app";
import type { ActiveAdmin } from "../../../../beat-auth";
import { GOOGLE_ALLOWED_EMAIL } from "../../../../beat-google";
import type { PrivateFictionGitHubActionsIdentity } from "../../github-actions-identity";
import {
  MAX_PRIVATE_FICTION_ANNOTATION_BYTES,
  MAX_PRIVATE_FICTION_SOURCE_BYTES,
  type PrivateFictionAnnotation,
  type PrivateFictionAnnotationsDocument,
  type PrivateFictionDocument,
  PrivateFictionStorageError,
} from "../../s3-private-fiction-repository";

const saveSchema = z.object({
  expectedEtag: z.string().max(256).nullable(),
  source: z.string().min(1).max(MAX_PRIVATE_FICTION_SOURCE_BYTES),
});

const githubSyncSchema = z.object({
  source: z.string().min(1).max(MAX_PRIVATE_FICTION_SOURCE_BYTES),
});

const annotationSchema = z
  .object({
    id: z.string().uuid(),
    episode: z.number().int().min(1).max(500),
    blockIndex: z.number().int().min(0).max(100_000),
    startOffset: z.number().int().min(0).max(1_000_000),
    endOffset: z.number().int().min(1).max(1_000_000),
    quote: z.string().min(1).max(2_000),
    prefix: z.string().max(100),
    suffix: z.string().max(100),
    comment: z.string().trim().min(1).max(5_000),
    createdAt: z.string().datetime(),
  })
  .refine((annotation) => annotation.endOffset > annotation.startOffset);

const saveAnnotationsSchema = z.object({
  expectedEtag: z.string().max(256).nullable(),
  annotations: z.array(annotationSchema).max(2_000),
});

export type PrivateFictionPort = {
  get: () => Promise<PrivateFictionDocument | undefined>;
  save: (input: { expectedEtag: string | null; source: string }) => Promise<{
    etag: string;
    updatedAt: string;
  }>;
  getAnnotations: () => Promise<PrivateFictionAnnotationsDocument | undefined>;
  saveAnnotations: (input: {
    expectedEtag: string | null;
    annotations: PrivateFictionAnnotation[];
  }) => Promise<PrivateFictionAnnotationsDocument>;
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
    verifyGitHubActionsToken: (
      token: string,
    ) => Promise<PrivateFictionGitHubActionsIdentity>;
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
    if (
      new TextEncoder().encode(parsed.data.source).byteLength >
      MAX_PRIVATE_FICTION_SOURCE_BYTES
    )
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

  app.post("/admin/private-fiction/github-sync", async (context) => {
    context.header("Cache-Control", "private, no-store, max-age=0");
    context.header("Vary", "Authorization");
    const token = bearer(context.req.header("authorization"));
    if (!token) return context.json({ error: "Unauthorized" }, 401);
    try {
      await options.verifyGitHubActionsToken(token);
    } catch {
      return context.json({ error: "Unauthorized" }, 401);
    }

    const parsed = githubSyncSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!parsed.success)
      return context.json({ error: "Invalid private manuscript" }, 400);
    const sourceBytes = new TextEncoder().encode(parsed.data.source).byteLength;
    if (sourceBytes > MAX_PRIVATE_FICTION_SOURCE_BYTES)
      return context.json({ error: "Invalid private manuscript" }, 400);

    try {
      const current = await options.store.get();
      if (current?.source === parsed.data.source)
        return context.json({
          etag: current.etag,
          updatedAt: current.updatedAt,
          sha256: createHash("sha256")
            .update(current.source, "utf8")
            .digest("hex"),
          sourceBytes,
          unchanged: true,
        });
      const saved = await options.store.save({
        expectedEtag: current?.etag ?? null,
        source: parsed.data.source,
      });
      const readback = await options.store.get();
      if (
        !readback ||
        readback.etag !== saved.etag ||
        readback.source !== parsed.data.source
      )
        return context.json(
          { error: "Private manuscript readback did not match the upload" },
          503,
        );
      return context.json({
        etag: readback.etag,
        updatedAt: readback.updatedAt,
        sha256: createHash("sha256")
          .update(readback.source, "utf8")
          .digest("hex"),
        sourceBytes,
        unchanged: false,
      });
    } catch (error) {
      if (
        error instanceof PrivateFictionStorageError &&
        error.code === "conflict"
      )
        return context.json(
          {
            error: "Manuscript changed during GitHub sync; retry the workflow",
          },
          409,
        );
      return context.json({ error: "Private manuscript unavailable" }, 503);
    }
  });

  app.get("/admin/private-fiction/annotations", async (context) => {
    context.header("Cache-Control", "private, no-store, max-age=0");
    context.header("Vary", "Authorization");
    const access = await owner(context);
    if (access.response) return access.response;
    try {
      const document = await options.store.getAnnotations();
      return context.json(
        document ?? { etag: null, annotations: [], updatedAt: null },
      );
    } catch {
      return context.json({ error: "Private feedback unavailable" }, 503);
    }
  });

  app.put("/admin/private-fiction/annotations", async (context) => {
    context.header("Cache-Control", "private, no-store, max-age=0");
    context.header("Vary", "Authorization");
    const access = await owner(context);
    if (access.response) return access.response;
    const parsed = saveAnnotationsSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!parsed.success)
      return context.json({ error: "Invalid private feedback" }, 400);
    if (
      new TextEncoder().encode(JSON.stringify(parsed.data.annotations))
        .byteLength > MAX_PRIVATE_FICTION_ANNOTATION_BYTES
    )
      return context.json({ error: "Invalid private feedback" }, 400);
    try {
      return context.json(await options.store.saveAnnotations(parsed.data));
    } catch (error) {
      if (
        error instanceof PrivateFictionStorageError &&
        error.code === "conflict"
      )
        return context.json(
          { error: "Feedback changed; reload before saving" },
          409,
        );
      return context.json({ error: "Private feedback unavailable" }, 503);
    }
  });
}
