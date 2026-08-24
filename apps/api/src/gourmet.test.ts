import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it, vi } from "vitest";

type StoredObject = { body: string | Uint8Array; etag: string };

function s3Harness() {
  const objects = new Map<string, StoredObject>();
  let version = 0;
  const send = vi.fn(async (command: unknown) => {
    const input = (
      command as {
        input: {
          Body?: string | Uint8Array;
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
        Body: {
          transformToByteArray: async () =>
            typeof stored.body === "string"
              ? new TextEncoder().encode(stored.body)
              : stored.body,
          transformToString: async () =>
            typeof stored.body === "string"
              ? stored.body
              : new TextDecoder().decode(stored.body),
        },
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
      objects.set(key, {
        body:
          input.Body instanceof Uint8Array
            ? new Uint8Array(input.Body)
            : String(input.Body),
        etag: `"v${version}"`,
      });
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
  vi.resetModules();
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

  it("validates an optimized image and stores it in S3", async () => {
    const harness = s3Harness();
    const gourmet = await loadGourmet();
    const created = await gourmet.createGourmetEntry(
      input,
      { subject: "admin-1" },
      harness.client,
    );
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
    );
    expect(updated.images[0]).toMatchObject({
      publicPath: expect.stringMatching(/^\/api\/gourmet\/images\//),
      storageKey: expect.stringMatching(/^v1\/gourmet\/images\//),
    });
    expect(updated.images[0]?.prUrl).toBeUndefined();
    expect(
      [...harness.objects.keys()].some((key) =>
        key.includes("/v1/gourmet/images/"),
      ),
    ).toBe(true);
    const image = await gourmet.getGourmetImage(
      created.id,
      updated.images[0]?.id ?? "",
      harness.client,
    );
    expect([...image.body]).toEqual([...webp]);
    expect(image.contentType).toBe("image/webp");
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
      ),
    ).rejects.toMatchObject({ code: "image_invalid" });
    await gourmet.updateGourmetEntry(
      created.id,
      { expectedRevision: 2, status: "draft" },
      "admin-1",
      harness.client,
    );
    await expect(
      gourmet.getGourmetImage(
        created.id,
        updated.images[0]?.id ?? "",
        harness.client,
      ),
    ).rejects.toMatchObject({ code: "image_not_found" });
    const adminImage = await gourmet.getGourmetImageForAdmin(
      created.id,
      updated.images[0]?.id ?? "",
      harness.client,
    );
    expect([...adminImage.body]).toEqual([...webp]);

    const removed = await gourmet.removeGourmetImage(
      created.id,
      updated.images[0]?.id ?? "",
      "admin-1",
      harness.client,
    );
    expect(removed.images).toHaveLength(0);
    expect(
      [...harness.objects.keys()].some((key) =>
        key.includes("/v1/gourmet/images/"),
      ),
    ).toBe(true);
    await expect(
      gourmet.removeGourmetImage(
        created.id,
        updated.images[0]?.id ?? "",
        "admin-1",
        harness.client,
      ),
    ).rejects.toMatchObject({ code: "image_not_found" });
  });

  it("keeps revision history, restores archives, and reorders image metadata", async () => {
    const harness = s3Harness();
    const gourmet = await loadGourmet();
    const created = await gourmet.createGourmetEntry(
      input,
      { subject: "admin-1" },
      harness.client,
    );
    const webp = Buffer.concat([
      Buffer.from("RIFF"),
      Buffer.alloc(4),
      Buffer.from("WEBP"),
      Buffer.alloc(24),
    ]);
    const withImage = await gourmet.attachGourmetImage(
      created.id,
      {
        altText: "첫 사진",
        contentBase64: webp.toString("base64"),
        contentType: "image/webp",
        originalFilename: "first.webp",
      },
      "admin-1",
      harness.client,
    );
    const image = withImage.images[0];
    if (!image) throw new Error("image was not attached");
    const updatedImage = await gourmet.updateGourmetImage(
      created.id,
      image.id,
      {
        altText: "정리한 사진",
        expectedRevision: withImage.revision,
        sortOrder: 0,
      },
      "admin-1",
      harness.client,
    );
    expect(updatedImage.images[0]).toMatchObject({
      altText: "정리한 사진",
      sortOrder: 0,
    });
    const archived = await gourmet.deleteGourmetEntry(
      created.id,
      "admin-1",
      harness.client,
    );
    expect(archived.status).toBe("deleted");
    await expect(
      gourmet.gourmetHistory(created.id, harness.client),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          revision: archived.revision,
          status: "deleted",
        }),
      ]),
    );
    const restored = await gourmet.restoreGourmetEntry(
      created.id,
      "admin-1",
      harness.client,
    );
    expect(restored).toMatchObject({
      status: "draft",
      revision: archived.revision + 1,
    });
  });

  it("persists exact visited dates and rejects publishing without one", async () => {
    const harness = s3Harness();
    const gourmet = await loadGourmet();
    await expect(
      gourmet.createGourmetEntry(
        { ...input, visitedAt: null },
        { subject: "admin-1", status: "published" },
        harness.client,
      ),
    ).rejects.toMatchObject({ code: "invalid" });
    const draft = await gourmet.createGourmetEntry(
      { ...input, status: "draft", visitedAt: null },
      { subject: "admin-1", status: "draft" },
      harness.client,
    );
    const dated = await gourmet.updateGourmetEntry(
      draft.id,
      { expectedRevision: draft.revision, visitedAt: "2026-08-03" },
      "admin-1",
      harness.client,
    );
    expect(dated.visitedAt).toBe("2026-08-03");
    await expect(
      gourmet.updateGourmetEntry(
        draft.id,
        {
          expectedRevision: dated.revision,
          status: "published",
          visitedAt: null,
        },
        "admin-1",
        harness.client,
      ),
    ).rejects.toMatchObject({ code: "invalid" });
    const published = await gourmet.updateGourmetEntry(
      draft.id,
      {
        expectedRevision: dated.revision,
        status: "published",
        visitedAt: dated.visitedAt,
      },
      "admin-1",
      harness.client,
    );
    expect(published).toMatchObject({
      status: "published",
      visitedAt: "2026-08-03",
    });
  });

  it("lists detached images and restores them without deleting S3 objects", async () => {
    const harness = s3Harness();
    const gourmet = await loadGourmet();
    const created = await gourmet.createGourmetEntry(
      input,
      { subject: "admin-1" },
      harness.client,
    );
    const webp = Buffer.concat([
      Buffer.from("RIFF"),
      Buffer.alloc(4),
      Buffer.from("WEBP"),
      Buffer.alloc(24),
    ]);
    const attached = await gourmet.attachGourmetImage(
      created.id,
      {
        altText: "복원할 사진",
        contentBase64: webp.toString("base64"),
        contentType: "image/webp",
        originalFilename: "meal.webp",
      },
      "admin-1",
      harness.client,
    );
    const image = attached.images[0];
    if (!image) throw new Error("image was not attached");
    const detached = await gourmet.removeGourmetImage(
      created.id,
      image.id,
      "admin-1",
      harness.client,
    );
    expect(detached.images).toHaveLength(0);
    await expect(
      gourmet.gourmetImageHistory(created.id, harness.client),
    ).resolves.toEqual([
      expect.objectContaining({
        image: expect.objectContaining({ id: image.id }),
        revision: attached.revision,
      }),
    ]);
    const restored = await gourmet.restoreGourmetImage(
      created.id,
      image.id,
      "admin-1",
      harness.client,
    );
    expect(restored.images).toEqual([
      expect.objectContaining({ id: image.id, sortOrder: 0 }),
    ]);
    await expect(
      gourmet.gourmetImageHistory(created.id, harness.client),
    ).resolves.toEqual([]);
    await expect(
      gourmet.restoreGourmetImage(
        created.id,
        image.id,
        "admin-1",
        harness.client,
      ),
    ).resolves.toMatchObject({ revision: restored.revision });
    expect(
      [...harness.objects.keys()].some((key) =>
        key.includes("/v1/gourmet/images/"),
      ),
    ).toBe(true);
  });
});
