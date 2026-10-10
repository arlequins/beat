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
  type PrivateFictionCatalog,
  type PrivateFictionDocument,
  PrivateFictionStorageError,
  type PrivateFictionWork,
} from "../../s3-private-fiction-repository";

const saveSchema = z.object({
  expectedEtag: z.string().max(256).nullable(),
  source: z.string().min(1).max(MAX_PRIVATE_FICTION_SOURCE_BYTES),
});

const githubSyncSchema = z.object({
  source: z.string().min(1).max(MAX_PRIVATE_FICTION_SOURCE_BYTES),
  target: z
    .object({
      workId: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/),
      title: z.string().trim().min(1).max(120),
      editionId: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/),
      editionLabel: z.string().trim().min(1).max(120),
    })
    .optional(),
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

const createWorkSchema = z.object({
  expectedCatalogEtag: z.string().max(256).nullable(),
  id: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/),
  title: z.string().trim().min(1).max(120),
  editionId: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/),
  editionLabel: z.string().trim().min(1).max(120),
  source: z.string().min(1).max(MAX_PRIVATE_FICTION_SOURCE_BYTES),
});

const saveEditionSchema = z.object({
  expectedEtag: z.string().max(256).nullable(),
  source: z.string().min(1).max(MAX_PRIVATE_FICTION_SOURCE_BYTES),
});

const createEditionSchema = z.object({
  expectedCatalogEtag: z.string().max(256).nullable(),
  id: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/),
  label: z.string().trim().min(1).max(120),
  source: z.string().min(1).max(MAX_PRIVATE_FICTION_SOURCE_BYTES),
});

export type PrivateFictionPort = {
  getCatalog: () => Promise<PrivateFictionCatalog>;
  saveCatalog: (input: {
    expectedEtag: string | null;
    works: PrivateFictionWork[];
  }) => Promise<string>;
  getEdition: (
    workId: string,
    editionId: string,
  ) => Promise<PrivateFictionDocument | undefined>;
  saveEdition: (
    workId: string,
    editionId: string,
    input: { expectedEtag: string | null; source: string },
  ) => Promise<{ etag: string; updatedAt: string }>;
  getEditionAnnotations: (
    workId: string,
    editionId: string,
  ) => Promise<PrivateFictionAnnotationsDocument | undefined>;
  saveEditionAnnotations: (
    workId: string,
    editionId: string,
    input: {
      expectedEtag: string | null;
      annotations: PrivateFictionAnnotation[];
    },
  ) => Promise<PrivateFictionAnnotationsDocument>;
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

  async function workAccess(context: Context<ApiBindings>, workId: string) {
    if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(workId))
      return { response: context.json({ error: "Not found" }, 404) };
    const access = await owner(context);
    if (access.response) return access;
    try {
      const catalog = await options.store.getCatalog();
      const work = catalog.works.find((entry) => entry.id === workId);
      if (
        !work ||
        (work.allowedSubjects.length > 0 &&
          !work.allowedSubjects.includes(access.identity.subject))
      )
        return { response: context.json({ error: "Not found" }, 404) };
      return { identity: access.identity, catalog, work };
    } catch {
      return {
        response: context.json({ error: "Private catalog unavailable" }, 503),
      };
    }
  }

  app.get("/admin/private-fictions", async (context) => {
    context.header("Cache-Control", "private, no-store, max-age=0");
    context.header("Vary", "Authorization");
    const access = await owner(context);
    if (access.response) return access.response;
    try {
      const catalog = await options.store.getCatalog();
      return context.json({
        etag: catalog.etag,
        works: catalog.works.filter(
          (work) =>
            work.allowedSubjects.length === 0 ||
            work.allowedSubjects.includes(access.identity.subject),
        ),
      });
    } catch {
      return context.json({ error: "Private catalog unavailable" }, 503);
    }
  });

  app.post("/admin/private-fictions", async (context) => {
    context.header("Cache-Control", "private, no-store, max-age=0");
    context.header("Vary", "Authorization");
    const access = await owner(context);
    if (access.response) return access.response;
    const parsed = createWorkSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!parsed.success)
      return context.json({ error: "Invalid private work" }, 400);
    if (
      new TextEncoder().encode(parsed.data.source).byteLength >
      MAX_PRIVATE_FICTION_SOURCE_BYTES
    )
      return context.json({ error: "Invalid private work" }, 400);
    try {
      const catalog = await options.store.getCatalog();
      if (catalog.etag !== parsed.data.expectedCatalogEtag)
        return context.json(
          { error: "Catalog changed; reload before saving" },
          409,
        );
      if (catalog.works.some((work) => work.id === parsed.data.id))
        return context.json({ error: "Work already exists" }, 409);
      const saved = await options.store.saveEdition(
        parsed.data.id,
        parsed.data.editionId,
        {
          expectedEtag: null,
          source: parsed.data.source,
        },
      );
      const now = new Date().toISOString();
      const work: PrivateFictionWork = {
        id: parsed.data.id,
        title: parsed.data.title,
        activeEditionId: parsed.data.editionId,
        editions: [
          { id: parsed.data.editionId, label: parsed.data.editionLabel },
        ],
        allowedSubjects: [access.identity.subject],
        createdAt: now,
        updatedAt: now,
      };
      const catalogEtag = await options.store.saveCatalog({
        expectedEtag: parsed.data.expectedCatalogEtag,
        works: [...catalog.works, work],
      });
      return context.json({ work, catalogEtag, ...saved }, 201);
    } catch (error) {
      if (
        error instanceof PrivateFictionStorageError &&
        error.code === "conflict"
      )
        return context.json(
          { error: "Catalog or manuscript changed; reload before saving" },
          409,
        );
      return context.json({ error: "Private work unavailable" }, 503);
    }
  });

  app.post("/admin/private-fictions/:workId/editions", async (context) => {
    context.header("Cache-Control", "private, no-store, max-age=0");
    context.header("Vary", "Authorization");
    const workId = context.req.param("workId");
    const access = await workAccess(context, workId);
    if (access.response) return access.response;
    const parsed = createEditionSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!parsed.success)
      return context.json({ error: "Invalid private edition" }, 400);
    if (
      new TextEncoder().encode(parsed.data.source).byteLength >
      MAX_PRIVATE_FICTION_SOURCE_BYTES
    )
      return context.json({ error: "Invalid private edition" }, 400);
    if (access.work.editions.some((edition) => edition.id === parsed.data.id))
      return context.json({ error: "Edition already exists" }, 409);
    if (access.catalog.etag !== parsed.data.expectedCatalogEtag)
      return context.json(
        { error: "Catalog changed; reload before saving" },
        409,
      );
    try {
      const saved = await options.store.saveEdition(workId, parsed.data.id, {
        expectedEtag: null,
        source: parsed.data.source,
      });
      const work = {
        ...access.work,
        activeEditionId: parsed.data.id,
        editions: [
          ...access.work.editions,
          { id: parsed.data.id, label: parsed.data.label },
        ],
        updatedAt: saved.updatedAt,
      };
      const catalogEtag = await options.store.saveCatalog({
        expectedEtag: parsed.data.expectedCatalogEtag,
        works: access.catalog.works.map((entry) =>
          entry.id === workId ? work : entry,
        ),
      });
      return context.json({ work, catalogEtag, ...saved }, 201);
    } catch (error) {
      if (
        error instanceof PrivateFictionStorageError &&
        error.code === "conflict"
      )
        return context.json(
          { error: "Catalog changed; reload before adding an edition" },
          409,
        );
      return context.json({ error: "Private edition unavailable" }, 503);
    }
  });

  app.get(
    "/admin/private-fictions/:workId/editions/:editionId",
    async (context) => {
      context.header("Cache-Control", "private, no-store, max-age=0");
      context.header("Vary", "Authorization");
      const workId = context.req.param("workId");
      const editionId = context.req.param("editionId");
      const access = await workAccess(context, workId);
      if (access.response) return access.response;
      if (!access.work.editions.some((edition) => edition.id === editionId))
        return context.json({ error: "Not found" }, 404);
      try {
        const document = await options.store.getEdition(workId, editionId);
        if (!document) return context.json({ error: "Not found" }, 404);
        return context.json({
          ...document,
          workId,
          workTitle: access.work.title,
          editionId,
        });
      } catch {
        return context.json({ error: "Private manuscript unavailable" }, 503);
      }
    },
  );

  app.put(
    "/admin/private-fictions/:workId/editions/:editionId",
    async (context) => {
      context.header("Cache-Control", "private, no-store, max-age=0");
      context.header("Vary", "Authorization");
      const workId = context.req.param("workId");
      const editionId = context.req.param("editionId");
      const access = await workAccess(context, workId);
      if (access.response) return access.response;
      if (!access.work.editions.some((edition) => edition.id === editionId))
        return context.json({ error: "Not found" }, 404);
      const parsed = saveEditionSchema.safeParse(
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
        const saved = await options.store.saveEdition(
          workId,
          editionId,
          parsed.data,
        );
        return context.json(saved);
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
    },
  );

  app.get(
    "/admin/private-fictions/:workId/editions/:editionId/annotations",
    async (context) => {
      context.header("Cache-Control", "private, no-store, max-age=0");
      context.header("Vary", "Authorization");
      const workId = context.req.param("workId");
      const editionId = context.req.param("editionId");
      const access = await workAccess(context, workId);
      if (access.response) return access.response;
      if (!access.work.editions.some((edition) => edition.id === editionId))
        return context.json({ error: "Not found" }, 404);
      try {
        const document = await options.store.getEditionAnnotations(
          workId,
          editionId,
        );
        return context.json(
          document ?? { etag: null, annotations: [], updatedAt: null },
        );
      } catch {
        return context.json({ error: "Private feedback unavailable" }, 503);
      }
    },
  );

  app.put(
    "/admin/private-fictions/:workId/editions/:editionId/annotations",
    async (context) => {
      context.header("Cache-Control", "private, no-store, max-age=0");
      context.header("Vary", "Authorization");
      const workId = context.req.param("workId");
      const editionId = context.req.param("editionId");
      const access = await workAccess(context, workId);
      if (access.response) return access.response;
      if (!access.work.editions.some((edition) => edition.id === editionId))
        return context.json({ error: "Not found" }, 404);
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
        return context.json(
          await options.store.saveEditionAnnotations(
            workId,
            editionId,
            parsed.data,
          ),
        );
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
    },
  );

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
      if (parsed.data.target) {
        const { workId, title, editionId, editionLabel } = parsed.data.target;
        const catalog = await options.store.getCatalog();
        const existing = catalog.works.find((work) => work.id === workId);
        const registered = existing?.editions.some(
          (edition) => edition.id === editionId,
        );
        const current = registered
          ? await options.store.getEdition(workId, editionId)
          : undefined;
        if (current?.source !== parsed.data.source) {
          try {
            await options.store.saveEdition(workId, editionId, {
              expectedEtag: current?.etag ?? null,
              source: parsed.data.source,
            });
          } catch (error) {
            // A previous attempt may have stored the edition before a catalog
            // conflict. Only adopt that object when its exact content matches.
            if (
              !(error instanceof PrivateFictionStorageError) ||
              error.code !== "conflict"
            )
              throw error;
            const competing = await options.store.getEdition(workId, editionId);
            if (competing?.source !== parsed.data.source) throw error;
          }
        }
        const readback = await options.store.getEdition(workId, editionId);
        if (!readback || readback.source !== parsed.data.source)
          return context.json(
            { error: "Private manuscript readback did not match the upload" },
            503,
          );
        const now = new Date().toISOString();
        const work: PrivateFictionWork = {
          id: workId,
          title,
          activeEditionId: editionId,
          editions: [
            ...(existing?.editions.filter(
              (edition) => edition.id !== editionId,
            ) ?? []),
            { id: editionId, label: editionLabel },
          ],
          allowedSubjects: existing?.allowedSubjects ?? [],
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        await options.store.saveCatalog({
          expectedEtag: catalog.etag,
          works: [
            ...catalog.works.filter((entry) => entry.id !== workId),
            work,
          ],
        });
        const catalogReadback = await options.store.getCatalog();
        const published = catalogReadback.works.find(
          (entry) => entry.id === workId,
        );
        if (
          published?.activeEditionId !== editionId ||
          published.title !== title
        )
          return context.json(
            { error: "Private catalog readback did not match the upload" },
            503,
          );
        return context.json({
          ...readback,
          source: undefined,
          workId,
          editionId,
          sha256: createHash("sha256")
            .update(readback.source, "utf8")
            .digest("hex"),
          sourceBytes,
          unchanged: current?.source === parsed.data.source,
        });
      }
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
