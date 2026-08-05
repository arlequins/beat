import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it, vi } from "vitest";

type StoredObject = { body: string; etag: string };

function s3Harness() {
  const objects = new Map<string, StoredObject>();
  let version = 0;
  const send = vi.fn(async (command: unknown) => {
    const input = (
      command as {
        input: {
          Body?: string;
          Bucket: string;
          IfMatch?: string;
          IfNoneMatch?: string;
          Key?: string;
          Prefix?: string;
        };
      }
    ).input;
    if (command instanceof ListObjectsV2Command) {
      const prefix = `${input.Bucket}/${input.Prefix ?? ""}`;
      return {
        Contents: [...objects.keys()]
          .filter((key) => key.startsWith(prefix))
          .map((key) => ({ Key: key.slice(input.Bucket.length + 1) })),
        IsTruncated: false,
      };
    }
    const key = `${input.Bucket}/${input.Key}`;
    if (command instanceof GetObjectCommand) {
      const stored = objects.get(key);
      if (!stored)
        throw Object.assign(new Error("missing"), {
          $metadata: { httpStatusCode: 404 },
          name: "NoSuchKey",
        });
      return {
        Body: { transformToString: async () => stored.body },
        ETag: stored.etag,
      };
    }
    if (command instanceof PutObjectCommand) {
      const current = objects.get(key);
      if (
        (input.IfNoneMatch === "*" && current) ||
        (input.IfMatch && current?.etag !== input.IfMatch)
      )
        throw Object.assign(new Error("conflict"), {
          $metadata: { httpStatusCode: 412 },
          name: "PreconditionFailed",
        });
      version += 1;
      objects.set(key, { body: String(input.Body), etag: `"v${version}"` });
      return {};
    }
    throw new Error("unexpected command");
  });
  return { client: { send } as unknown as S3Client, objects };
}

async function loadGourmet() {
  vi.stubEnv("BEAT_AUTH_STATE_BUCKET", "beat-state");
  vi.stubEnv("BEAT_AUTH_LEDGER_BUCKET", "beat-ledger");
  vi.stubEnv("BEAT_AUTH_STATE_PREFIX", "v1");
  vi.stubEnv("BEAT_AUTH_LEDGER_RETENTION_DAYS", "365");
  vi.stubEnv("GITHUB_CONTENT_REPOSITORY", "arlequins/beat");
  vi.resetModules();
  vi.doMock("./github-app", () => ({
    createGitHubInstallationToken: vi.fn(async () => ({
      expires_at: "2026-08-05T01:00:00.000Z",
      token: "installation-token",
    })),
  }));
  return import("./gourmet");
}

const input = {
  area: "東京",
  cookingMethods: ["구이"],
  cuisineTags: ["일식"],
  discoveries: ["산초 향"],
  externalRequestId: "chat-1",
  freeTextNote: "모바일에서 기록",
  ingredients: ["장어", "쌀"],
  liked: ["바삭한 껍질"],
  menuName: "うな重",
  nutritionTags: ["단백질"],
  postMealNotes: ["양이 알맞음"],
  rating: 8.5,
  restaurantBranch: null,
  restaurantName: "鰻の店",
  revisit: "yes" as const,
  source: "chatgpt" as const,
  status: "published" as const,
  summary: "숯향과 산초가 선명한 장어 덮밥",
  tasteNotes: ["고소함", "짭짤함"],
  visitedAt: "2026-08-05",
};

afterEach(() => {
  vi.doUnmock("./github-app");
  vi.unstubAllEnvs();
});

describe("Gourmet S3 records", () => {
  it("creates one Unicode record for repeated idempotent requests", async () => {
    const harness = s3Harness();
    const gourmet = await loadGourmet();
    const first = await gourmet.createGourmetEntry(
      input,
      { idempotencyKey: "same-message", subject: "chatgpt-action" },
      harness.client,
    );
    const repeated = await gourmet.createGourmetEntry(
      input,
      { idempotencyKey: "same-message", subject: "chatgpt-action" },
      harness.client,
    );
    expect(repeated.id).toBe(first.id);
    expect(first).toMatchObject({ restaurantName: "鰻の店", revision: 1 });
    await expect(
      gourmet.createGourmetEntry(
        { ...input, rating: 2 },
        { idempotencyKey: "same-message", subject: "chatgpt-action" },
        harness.client,
      ),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("filters, aggregates, updates, and soft-deletes records", async () => {
    const harness = s3Harness();
    const gourmet = await loadGourmet();
    const created = await gourmet.createGourmetEntry(
      input,
      { subject: "admin-1" },
      harness.client,
    );
    await expect(
      gourmet.listGourmetEntries(
        { area: "東京", minRating: 8, status: "published" },
        harness.client,
      ),
    ).resolves.toMatchObject({ total: 1 });
    const context = await gourmet.gourmetContext(
      { days: 30, limit: 10 },
      harness.client,
    );
    expect(context).toMatchObject({ averageRating: 8.5 });
    expect(context.revisitCandidates).toHaveLength(1);
    const updated = await gourmet.updateGourmetEntry(
      created.id,
      { expectedRevision: 1, rating: 9 },
      "admin-1",
      harness.client,
    );
    expect(updated).toMatchObject({ rating: 9, revision: 2 });
    await expect(
      gourmet.updateGourmetEntry(
        created.id,
        { expectedRevision: 1, rating: 5 },
        "admin-2",
        harness.client,
      ),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      gourmet.deleteGourmetEntry(created.id, "admin-1", harness.client),
    ).resolves.toMatchObject({ status: "deleted" });
  });

  it("covers filter misses, slug lookup, pagination, and empty context", async () => {
    const harness = s3Harness();
    const gourmet = await loadGourmet();
    const first = await gourmet.createGourmetEntry(
      { ...input, visitedAt: "2000-01-02" },
      { subject: "admin-1" },
      harness.client,
    );
    await gourmet.createGourmetEntry(
      {
        ...input,
        area: "大阪",
        cuisineTags: ["양식"],
        ingredients: ["밀"],
        rating: 4,
        restaurantName: "다른 식당",
        revisit: "no",
        visitedAt: "2000-01-01",
      },
      { subject: "admin-1" },
      harness.client,
    );
    await expect(
      gourmet.getGourmetEntry(first.slug, harness.client),
    ).resolves.toMatchObject({ entry: { id: first.id } });
    const page = await gourmet.listGourmetEntries(
      { page: 1, pageSize: 1 },
      harness.client,
    );
    expect(page).toMatchObject({ nextPage: 2, total: 2 });
    for (const filter of [
      { area: "부산" },
      { cuisineTag: "중식" },
      { ingredient: "감자" },
      { minRating: 9 },
      { restaurantName: "없는 곳" },
      { revisit: "unknown" as const },
      { from: "2030-01-01" },
      { to: "1999-01-01" },
    ]) {
      const result = await gourmet.listGourmetEntries(
        { ...filter, status: "published" },
        harness.client,
      );
      expect(result.total).toBe(0);
    }
    const empty = await gourmet.gourmetContext(
      { days: 1, limit: 5 },
      harness.client,
    );
    expect(empty).toMatchObject({ averageRating: null, recentEntries: [] });
  });

  it("validates an optimized image and opens a repository pull request", async () => {
    const harness = s3Harness();
    const gourmet = await loadGourmet();
    const created = await gourmet.createGourmetEntry(
      input,
      { subject: "admin-1" },
      harness.client,
    );
    const request = vi.fn(
      async (requestInput: string | URL, init?: RequestInit) => {
        const url = String(requestInput);
        if (url.endsWith("/git/ref/heads/main"))
          return Response.json({ object: { sha: "main-sha" } });
        if (url.endsWith("/git/refs"))
          return Response.json({}, { status: 201 });
        if (url.includes("/contents/") && init?.method !== "PUT")
          return Response.json({}, { status: 404 });
        if (url.includes("/contents/") && init?.method === "PUT") {
          expect(JSON.parse(String(init.body))).toMatchObject({
            branch: expect.stringContaining("content/gourmet-"),
          });
          return Response.json({}, { status: 201 });
        }
        if (url.endsWith("/pulls"))
          return Response.json(
            { html_url: "https://github.com/arlequins/beat/pull/40" },
            { status: 201 },
          );
        throw new Error(`unexpected GitHub request ${url}`);
      },
    ) as typeof fetch;
    const webp = Buffer.concat([
      Buffer.from("RIFF"),
      Buffer.alloc(4),
      Buffer.from("WEBP"),
      Buffer.alloc(24),
    ]);
    const updated = await gourmet.attachGourmetImage(
      created.id,
      {
        altText: "장어 덮밥",
        contentBase64: webp.toString("base64"),
        contentType: "image/webp",
        originalFilename: "meal.webp",
      },
      "admin-1",
      harness.client,
      request,
    );
    expect(updated.images[0]).toMatchObject({
      prUrl: "https://github.com/arlequins/beat/pull/40",
      publicPath: expect.stringMatching(/^\/gourmet\//),
      repositoryPath: expect.stringMatching(/^apps\/web\/public\/gourmet\//),
    });
    const repeated = await gourmet.attachGourmetImage(
      created.id,
      {
        altText: "장어 덮밥",
        contentBase64: webp.toString("base64"),
        contentType: "image/webp",
        originalFilename: "meal.webp",
      },
      "admin-1",
      harness.client,
      request,
    );
    expect(repeated.images).toHaveLength(1);
    await expect(
      gourmet.attachGourmetImage(
        created.id,
        {
          altText: "텍스트",
          contentBase64: Buffer.from("not-an-image").toString("base64"),
          contentType: "image/webp",
          originalFilename: "meal.webp",
        },
        "admin-1",
        harness.client,
        request,
      ),
    ).rejects.toMatchObject({ code: "image_invalid" });
    await expect(
      gourmet.attachGourmetImage(
        created.id,
        {
          altText: "JPEG mismatch",
          contentBase64: Buffer.from([0xff, 0xd8, 0xff, 0, 0]).toString(
            "base64",
          ),
          contentType: "image/png",
          originalFilename: "meal.png",
        },
        "admin-1",
        harness.client,
        request,
      ),
    ).rejects.toMatchObject({ code: "image_invalid" });
    await expect(
      gourmet.attachGourmetImage(
        created.id,
        {
          altText: "PNG mismatch",
          contentBase64: Buffer.from([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
          ]).toString("base64"),
          contentType: "image/webp",
          originalFilename: "meal.webp",
        },
        "admin-1",
        harness.client,
        request,
      ),
    ).rejects.toMatchObject({ code: "image_invalid" });
  });
});
