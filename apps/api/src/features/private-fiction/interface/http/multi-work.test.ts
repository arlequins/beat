import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it, vi } from "vitest";
import type { ApiBindings } from "../../../../app";
import { GOOGLE_ALLOWED_EMAIL } from "../../../../beat-google";
import {
  type PrivateFictionCatalog,
  type PrivateFictionDocument,
  PrivateFictionStorageError,
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
  it("creates works and editions and keeps feedback in the selected edition", async () => {
    const { app, headers, store } = fixture();
    const request = (path: string, body: unknown, method = "POST") =>
      app.request(path, { headers, method, body: JSON.stringify(body) });
    expect(
      (
        await request("/admin/private-fictions", {
          expectedCatalogEtag: null,
          id: "book",
          title: "Book",
          editionId: "first",
          editionLabel: "First",
          source: "One",
        })
      ).status,
    ).toBe(201);
    expect((await store.getCatalog()).works[0]?.allowedSubjects).toEqual([
      "owner",
    ]);
    expect(
      (
        await request("/admin/private-fictions/book/editions", {
          expectedCatalogEtag: "catalog",
          id: "second",
          label: "Second",
          source: "Two",
        })
      ).status,
    ).toBe(201);
    expect((await store.getCatalog()).works[0]?.activeEditionId).toBe("second");
    const path = "/admin/private-fictions/book/editions/second";
    expect(
      (
        await request(
          path,
          { expectedEtag: "document", source: "Updated" },
          "PUT",
        )
      ).status,
    ).toBe(200);
    expect((await (await app.request(path, { headers })).json()).source).toBe(
      "Updated",
    );
    expect(
      (await (await app.request(`${path}/annotations`, { headers })).json())
        .annotations,
    ).toEqual([]);
    const feedback = { etag: "feedback", annotations: [], updatedAt: "now" };
    vi.mocked(store.getEditionAnnotations).mockResolvedValueOnce(feedback);
    expect(
      (await (await app.request(`${path}/annotations`, { headers })).json())
        .etag,
    ).toBe("feedback");
    vi.mocked(store.saveEditionAnnotations).mockResolvedValueOnce(feedback);
    expect(
      (
        await request(
          `${path}/annotations`,
          { expectedEtag: null, annotations: [] },
          "PUT",
        )
      ).status,
    ).toBe(200);
    expect(store.saveEditionAnnotations).toHaveBeenCalledWith(
      "book",
      "second",
      { expectedEtag: null, annotations: [] },
    );
  });

  it("rejects stale catalog writes before storing a new object", async () => {
    const { app, headers, store, sync } = fixture();
    await sync("book", "One");
    for (const [path, body] of [
      [
        "/admin/private-fictions",
        {
          expectedCatalogEtag: null,
          id: "another",
          title: "Book",
          editionId: "first",
          editionLabel: "First",
          source: "One",
        },
      ],
      [
        "/admin/private-fictions/book/editions",
        {
          expectedCatalogEtag: null,
          id: "second",
          label: "Second",
          source: "Two",
        },
      ],
      [
        "/admin/private-fictions",
        {
          expectedCatalogEtag: "catalog",
          id: "book",
          title: "Book",
          editionId: "first",
          editionLabel: "First",
          source: "One",
        },
      ],
      [
        "/admin/private-fictions/book/editions",
        {
          expectedCatalogEtag: "catalog",
          id: "first",
          label: "First",
          source: "One",
        },
      ],
    ] as const) {
      expect(
        (
          await app.request(path, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
          })
        ).status,
      ).toBe(409);
    }
    expect(store.saveEdition).toHaveBeenCalledTimes(1);
  });

  it("handles invalid input, missing editions, and denied accounts on every scoped route", async () => {
    const { app, headers, sync } = fixture();
    await sync("book", "One");
    const paths = [
      ["/admin/private-fictions", "POST"],
      ["/admin/private-fictions/book/editions", "POST"],
      ["/admin/private-fictions/book/editions/first", "PUT"],
      ["/admin/private-fictions/book/editions/first/annotations", "PUT"],
    ] as const;
    for (const [path, method] of paths) {
      expect(
        (await app.request(path, { method, headers, body: "bad json" })).status,
      ).toBe(400);
      expect((await app.request(path, { method, body: "{}" })).status).toBe(
        401,
      );
    }
    for (const suffix of ["", "/annotations"]) {
      for (const method of ["GET", "PUT"]) {
        expect(
          (
            await app.request(
              `/admin/private-fictions/book/editions/absent${suffix}`,
              { headers, method },
            )
          ).status,
        ).toBe(404);
        expect(
          (
            await app.request(
              `/admin/private-fictions/absent/editions/first${suffix}`,
              { headers, method },
            )
          ).status,
        ).toBe(404);
      }
    }
    expect(
      (
        await app.request("/admin/private-fictions/INVALID/editions/first", {
          headers,
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await app.request("/admin/private-fictions", {
          headers: { Authorization: "Bearer other" },
        })
      ).status,
    ).toBe(404);
  });

  it.each(["conflict", "storage_unavailable"] as const)(
    "reports %s writes without claiming success",
    async (code) => {
      const { app, headers, sync, store } = fixture();
      await sync("book", "One");
      const status = code === "conflict" ? 409 : 503;
      const requests = [
        [
          "/admin/private-fictions",
          "POST",
          {
            expectedCatalogEtag: "catalog",
            id: "another",
            title: "Another",
            editionId: "first",
            editionLabel: "First",
            source: "One",
          },
          "saveEdition",
        ],
        [
          "/admin/private-fictions/book/editions",
          "POST",
          {
            expectedCatalogEtag: "catalog",
            id: "second",
            label: "Second",
            source: "Two",
          },
          "saveEdition",
        ],
        [
          "/admin/private-fictions/book/editions/first",
          "PUT",
          { expectedEtag: "document", source: "Two" },
          "saveEdition",
        ],
        [
          "/admin/private-fictions/book/editions/first/annotations",
          "PUT",
          { expectedEtag: null, annotations: [] },
          "saveEditionAnnotations",
        ],
      ] as const;
      for (const [path, method, body, port] of requests) {
        vi.mocked(store[port]).mockRejectedValueOnce(
          new PrivateFictionStorageError(code),
        );
        expect(
          (
            await app.request(path, {
              method,
              headers,
              body: JSON.stringify(body),
            })
          ).status,
        ).toBe(status);
      }
    },
  );

  it("reports unavailable and missing reads", async () => {
    const { app, headers, sync, store } = fixture();
    await sync("book", "One");
    vi.mocked(store.getEdition).mockResolvedValueOnce(undefined);
    expect(
      (
        await app.request("/admin/private-fictions/book/editions/first", {
          headers,
        })
      ).status,
    ).toBe(404);
    vi.mocked(store.getEdition).mockRejectedValueOnce(new Error("unavailable"));
    expect(
      (
        await app.request("/admin/private-fictions/book/editions/first", {
          headers,
        })
      ).status,
    ).toBe(503);
    vi.mocked(store.getEditionAnnotations).mockRejectedValueOnce(
      new Error("unavailable"),
    );
    expect(
      (
        await app.request(
          "/admin/private-fictions/book/editions/first/annotations",
          { headers },
        )
      ).status,
    ).toBe(503);
    for (const path of [
      "/admin/private-fictions",
      "/admin/private-fictions/book/editions/first",
    ]) {
      vi.mocked(store.getCatalog).mockRejectedValueOnce(
        new Error("unavailable"),
      );
      expect((await app.request(path, { headers })).status).toBe(503);
    }
  });

  it("does not publish mismatching manuscript or catalog readback", async () => {
    const { sync, store } = fixture();
    vi.mocked(store.getEdition).mockResolvedValueOnce(undefined);
    expect((await sync("book", "One")).status).toBe(503);
    expect(store.saveCatalog).not.toHaveBeenCalled();
    vi.mocked(store.saveCatalog).mockResolvedValueOnce("ignored");
    expect((await sync("another", "Two")).status).toBe(503);
  });

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
