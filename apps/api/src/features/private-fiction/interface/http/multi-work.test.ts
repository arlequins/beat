import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it, vi } from "vitest";
import type { ApiBindings } from "../../../../app";
import { GOOGLE_ALLOWED_EMAIL } from "../../../../beat-google";
import type {
  PrivateFictionCatalog,
  PrivateFictionDocument,
} from "../../s3-private-fiction-repository";
import {
  type PrivateFictionPort,
  registerPrivateFictionRoutes,
} from "./routes";

function fixture() {
  let catalog: PrivateFictionCatalog = { etag: null, works: [] };
  const documents = new Map<string, PrivateFictionDocument>();
  const store: PrivateFictionPort = {
    getCatalog: vi.fn(async () => catalog),
    saveCatalog: vi.fn(async (input) => {
      catalog = { etag: "catalog", works: input.works };
      return "catalog";
    }),
    getEdition: vi.fn(async (work, edition) =>
      documents.get(`${work}/${edition}`),
    ),
    saveEdition: vi.fn(async (work, edition, input) => {
      documents.set(`${work}/${edition}`, {
        etag: "document",
        source: input.source,
        updatedAt: "now",
      });
      return { etag: "document", updatedAt: "now" };
    }),
    getEditionAnnotations: vi.fn(async () => undefined),
    saveEditionAnnotations: vi.fn(),
    get: vi.fn(),
    save: vi.fn(),
    getAnnotations: vi.fn(),
    saveAnnotations: vi.fn(),
  };
  const app = new OpenAPIHono<ApiBindings>();
  registerPrivateFictionRoutes(app, {
    store,
    verifyAccessToken: async (token) => ({
      email: token === "owner" ? GOOGLE_ALLOWED_EMAIL : "other@example.com",
      subject: token,
    }),
    verifyGitHubActionsToken: vi.fn(async () => {
      return {} as never;
    }),
  });
  const headers = {
    Authorization: "Bearer owner",
    "Content-Type": "application/json",
  };
  const sync = (workId: string, source: string) =>
    app.request("/admin/private-fiction/github-sync", {
      method: "POST",
      headers,
      body: JSON.stringify({
        source,
        target: {
          workId,
          title: workId,
          editionId: "first",
          editionLabel: "First",
        },
      }),
    });
  return { app, headers, sync, store };
}

describe("multiple private works", () => {
  it("publishes two separate editions and verifies their bytes without returning text", async () => {
    const { app, headers, sync, store } = fixture();
    for (const [work, text] of [
      ["book-a", "# 1화\n\nAlpha"],
      ["book-b", "# 1화\n\nBeta"],
    ]) {
      const result = await sync(work!, text!);
      expect(result.status).toBe(200);
      const body = await result.json();
      expect(body.source).toBeUndefined();
      expect(body.sourceBytes).toBe(new TextEncoder().encode(text).byteLength);
    }
    const catalog = await (
      await app.request("/admin/private-fictions", { headers })
    ).json();
    expect(catalog.works.map((work: { id: string }) => work.id)).toEqual([
      "book-a",
      "book-b",
    ]);
    for (const [id, expected] of [
      ["book-a", "Alpha"],
      ["book-b", "Beta"],
    ]) {
      const response = await app.request(
        `/admin/private-fictions/${id}/editions/first`,
        { headers },
      );
      expect((await response.json()).source).toContain(expected);
    }
    await sync("book-a", "# 1화\n\nAlpha");
    expect(store.saveEdition).toHaveBeenCalledTimes(2);
    expect((await app.request("/admin/private-fictions")).status).toBe(401);
    expect(
      (
        await app.request("/admin/private-fictions/book-a/editions/first", {
          headers: { Authorization: "Bearer other" },
        })
      ).status,
    ).toBe(404);
  });

  it("checks per-work membership and edition IDs before reading storage", async () => {
    const { app, headers, sync, store } = fixture();
    await sync("book-a", "Alpha");
    const catalog = await store.getCatalog();
    catalog.works[0]!.allowedSubjects = ["another-owner-subject"];
    expect(
      (
        await app.request("/admin/private-fictions/book-a/editions/first", {
          headers,
        })
      ).status,
    ).toBe(404);
    catalog.works[0]!.allowedSubjects = [];
    expect(
      (
        await app.request("/admin/private-fictions/book-a/editions/missing", {
          headers,
        })
      ).status,
    ).toBe(404);
    expect(store.getEdition).toHaveBeenCalledTimes(1);
  });
});
