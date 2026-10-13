import { createLogger } from "@arlequins/logger";
import { describe, expect, it, vi } from "vitest";
import { createApiApp } from "../../../../app";
import { GOOGLE_ALLOWED_EMAIL } from "../../../../beat-google";
import type { PrivateFictionPort } from "./routes";

const editionPath =
  "/admin/private-fictions/reality-error-0/editions/prequel-final-001-058-20261013-v5-0-0";
const readPaths = ["/admin/private-fictions", editionPath];

function fixture(email = "beat.lumen@gmail.com", subject = "reader-id") {
  const document = {
    etag: "document",
    source: "# 1화\n\nReading fixture",
    updatedAt: "2026-10-13T00:00:00.000Z",
  };
  const catalog = {
    etag: "catalog",
    works: [
      {
        id: "reality-error-0",
        title: "Reading fixture",
        activeEditionId: "prequel-final-001-058-20261013-v5-0-0",
        editions: [
          { id: "prequel-final-001-058-20261013-v5-0-0", label: "Final" },
        ],
        allowedSubjects: [] as string[],
        createdAt: document.updatedAt,
        updatedAt: document.updatedAt,
      },
    ],
  };
  const store: PrivateFictionPort = {
    getCatalog: vi.fn(async () => catalog),
    saveCatalog: vi.fn(),
    getEdition: vi.fn(async () => document),
    saveEdition: vi.fn(),
    getEditionAnnotations: vi.fn(),
    saveEditionAnnotations: vi.fn(),
    get: vi.fn(),
    save: vi.fn(),
    getAnnotations: vi.fn(),
    saveAnnotations: vi.fn(),
  };
  const verifyAccessToken = vi.fn(async (token: string) => {
    if (token !== "verified-token") throw new Error("Invalid token");
    return { email, subject };
  });
  const app = createApiApp({
    corsOrigins: [],
    logger: createLogger({ service: "api", sink: () => {} }),
    privateFiction: store,
    privateFictionGitHubActions: {
      verifyToken: vi.fn(async () => {
        throw new Error("Not a GitHub Actions identity");
      }),
    },
    rateLimiter: false,
    beatAuth: {
      authenticate: vi.fn(),
      issueTokenPair: vi.fn(),
      jwks: vi.fn(async () => ({ keys: [] })),
      refreshTokenPair: vi.fn(),
      revokeRefreshToken: vi.fn(),
      verifyAccessToken,
    },
  });
  const headers = { Authorization: "Bearer verified-token" };
  return { app, catalog, document, headers, store, verifyAccessToken };
}

function expectNoStorageAccess(store: PrivateFictionPort) {
  for (const operation of Object.values(store))
    expect(operation).not.toHaveBeenCalled();
}

describe("private fiction reading access", () => {
  it.each([
    GOOGLE_ALLOWED_EMAIL,
    "beat.lumen@gmail.com",
    " BEAT.LUMEN@GMAIL.COM ",
  ])(
    "allows verified %s to read the catalog and edition body",
    async (email) => {
      const { app, catalog, document, headers, store, verifyAccessToken } =
        fixture(email);
      const list = await app.request(readPaths[0]!, { headers });
      expect(list.status).toBe(200);
      await expect(list.json()).resolves.toEqual(catalog);
      const edition = await app.request(editionPath, { headers });
      expect(edition.status).toBe(200);
      await expect(edition.json()).resolves.toMatchObject(document);
      for (const response of [list, edition]) {
        expect(response.headers.get("cache-control")).toContain("no-store");
        expect(response.headers.get("vary")).toContain("Authorization");
      }
      expect(verifyAccessToken).toHaveBeenCalledWith("verified-token");
      expect(store.getEdition).toHaveBeenCalledWith(
        "reality-error-0",
        "prequel-final-001-058-20261013-v5-0-0",
      );
    },
  );

  it.each([
    "other@example.com",
    "beat.lumen+test@gmail.com",
    "beatlumen@gmail.com",
    "beat.lumen@googlemail.com",
    "beat.lumen@gmail.com.example.com",
  ])("denies %s before any storage access", async (email) => {
    const { app, headers, store } = fixture(email);
    for (const path of readPaths) {
      const response = await app.request(path, { headers });
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: "Not found" });
    }
    expectNoStorageAccess(store);
  });

  it("rejects missing, malformed and invalid authentication", async () => {
    const { app, store } = fixture();
    for (const path of readPaths) {
      for (const authorization of [
        undefined,
        "Basic invalid",
        "Bearer invalid",
      ]) {
        const response = await app.request(path, {
          headers: authorization ? { Authorization: authorization } : {},
        });
        expect(response.status).toBe(401);
      }
    }
    expectNoStorageAccess(store);
  });

  it.each([GOOGLE_ALLOWED_EMAIL, "beat.lumen@gmail.com"])(
    "rejects a verified %s identity without a subject",
    async (email) => {
      const { app, headers, store } = fixture(email, "  ");
      for (const path of readPaths)
        expect((await app.request(path, { headers })).status).toBe(404);
      expectNoStorageAccess(store);
    },
  );

  it("preserves work membership and edition checks for the reader", async () => {
    const { app, catalog, headers, store } = fixture();
    catalog.works[0]!.allowedSubjects = ["owner-id"];
    const list = await app.request(readPaths[0]!, { headers });
    await expect(list.json()).resolves.toEqual({ etag: "catalog", works: [] });
    expect((await app.request(editionPath, { headers })).status).toBe(404);
    expect(store.getEdition).not.toHaveBeenCalled();
    catalog.works[0]!.allowedSubjects.push("reader-id");
    expect((await app.request(editionPath, { headers })).status).toBe(200);
    vi.mocked(store.getEdition).mockClear();
    for (const path of [
      editionPath.replace("reality-error-0", "missing-work"),
      editionPath.replace("reality-error-0", "INVALID"),
      editionPath.replace(
        "prequel-final-001-058-20261013-v5-0-0",
        "missing-edition",
      ),
    ])
      expect((await app.request(path, { headers })).status).toBe(404);
    expect(store.getEdition).not.toHaveBeenCalled();
  });

  it.each([
    ["/admin/private-fictions", "POST", 404],
    ["/admin/private-fictions/reality-error-0/editions", "POST", 404],
    [editionPath, "PUT", 404],
    [editionPath, "DELETE", 404],
    [`${editionPath}/annotations`, "GET", 404],
    [`${editionPath}/annotations`, "PUT", 404],
    ["/admin/private-fiction", "GET", 404],
    ["/admin/private-fiction", "PUT", 404],
    ["/admin/private-fiction/annotations", "GET", 404],
    ["/admin/private-fiction/annotations", "PUT", 404],
    ["/admin/private-fiction/github-sync", "POST", 401],
  ] as const)("blocks reader %s %s", async (path, method, status) => {
    const { app, headers, store } = fixture();
    const response = await app.request(path, {
      headers: { ...headers, "Content-Type": "application/json" },
      method,
      ...(method === "GET"
        ? {}
        : { body: JSON.stringify({ source: "Attempt" }) }),
    });
    expect(response.status).toBe(status);
    expectNoStorageAccess(store);
  });
});
