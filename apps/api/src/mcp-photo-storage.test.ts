import { createLogger } from "@arlequins/logger";
import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GourmetEntry } from "./features/gourmet/domain/models";

// Exercise the real MCP decoder and repository together. Only transport is fake:
// no HTTP request, AWS client, or production meal is used by this harness.
function storageHarness() {
  const objects = new Map<
    string,
    { body: string | Uint8Array; etag: string }
  >();
  let revision = 0;
  let imageWrites = 0;
  let failImageWrite: number | undefined;
  const client = {
    send: vi.fn(async (command: unknown) => {
      if (command instanceof ListObjectsV2Command) {
        const prefix = `${command.input.Bucket}/${command.input.Prefix ?? ""}`;
        return {
          Contents: [...objects.keys()]
            .filter((key) => key.startsWith(prefix))
            .map((key) => ({
              Key: key.slice(`${command.input.Bucket}/`.length),
            })),
          IsTruncated: false,
        };
      }
      if (command instanceof GetObjectCommand) {
        const object = objects.get(
          `${command.input.Bucket}/${command.input.Key}`,
        );
        if (!object)
          throw Object.assign(new Error("missing fixture"), {
            name: "NoSuchKey",
            $metadata: { httpStatusCode: 404 },
          });
        return {
          Body: { transformToString: async () => String(object.body) },
          ETag: object.etag,
        };
      }
      if (command instanceof PutObjectCommand) {
        const input = command.input;
        const key = `${input.Bucket}/${input.Key}`;
        if (
          input.Body instanceof Uint8Array &&
          ++imageWrites === failImageWrite
        )
          throw new Error("Simulated transient image-store failure");
        const previous = objects.get(key);
        if (
          (input.IfNoneMatch === "*" && previous) ||
          (input.IfMatch && previous?.etag !== input.IfMatch)
        )
          throw Object.assign(new Error("conditional write conflict"), {
            $metadata: { httpStatusCode: 412 },
          });
        const etag = `"v${++revision}"`;
        objects.set(key, {
          body:
            input.Body instanceof Uint8Array ? input.Body : String(input.Body),
          etag,
        });
        return { ETag: etag };
      }
      throw new Error("Unexpected storage operation");
    }),
  } as unknown as S3Client;
  return {
    client,
    objects,
    failImageWrite(number: number) {
      failImageWrite = number;
    },
    entries() {
      return [...objects.entries()]
        .filter(([key]) => key.endsWith("/head.json"))
        .map(([, object]) => JSON.parse(String(object.body)) as GourmetEntry);
    },
  };
}

async function harness() {
  vi.stubEnv("BEAT_AUTH_STATE_BUCKET", "test-state");
  vi.stubEnv("BEAT_AUTH_LEDGER_BUCKET", "test-ledger");
  vi.stubEnv("BEAT_AUTH_STATE_PREFIX", "v1");
  vi.resetModules();
  const { createApiApp } = await import("./app");
  const { createGourmetEntry, attachGourmetImage } = await import("./gourmet");
  const storage = storageHarness();
  const app = createApiApp({
    logger: createLogger({ service: "api", sink: () => {} }),
    rateLimiter: false,
    mcp: {
      issuer: "https://api.example.com/auth",
      resource: "https://api.example.com/mcp",
    },
    beatAuth: {
      authenticate: vi.fn(),
      issueTokenPair: vi.fn(),
      jwks: vi.fn(),
      refreshTokenPair: vi.fn(),
      revokeRefreshToken: vi.fn(),
      verifyAccessToken: vi.fn(),
      verifyAccessTokenForAudience: vi.fn(async () => ({
        email: "admin@example.com",
        subject: "test-admin",
        scopes: ["gourmet:write"],
      })),
    },
    gourmet: {
      create: (input, options) =>
        createGourmetEntry(input, options, storage.client),
      attachImage: (id, input, subject) =>
        attachGourmetImage(id, input, subject, storage.client),
    },
  });
  return { storage, app };
}

async function fixturePhotos() {
  return Promise.all(
    [30, 90, 190].map((r) =>
      sharp({
        create: {
          background: { r, g: 120, b: 30 },
          channels: 3,
          width: 1152,
          height: 1536,
        },
      })
        .jpeg()
        .toBuffer(),
    ),
  );
}

async function importPhotos(
  app: Awaited<ReturnType<typeof harness>>["app"],
  photos: Buffer[],
  attempt = 0,
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: URL) => {
      const photo = photos[Number(url.pathname.slice(1))];
      if (!photo) throw new Error("Unexpected file fixture");
      return new Response(new Uint8Array(photo), {
        headers: { "content-type": "image/jpeg" },
      });
    }),
  );
  const response = await app.request("/mcp", {
    method: "POST",
    headers: {
      Authorization: "Bearer test-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: `import-${attempt}`,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "gourmet_confirm_import",
        arguments: {
          confirmed: true,
          entries: [
            {
              restaurantName: "Fixture restaurant",
              menuName: "Fixture lunch",
              rating: 8,
              revisit: "yes",
              summary: "Synthetic test meal",
            },
          ],
          sourceConversation: "photo-storage-regression",
          images: photos.map((_, index) => ({
            download_url: `https://files.oaiusercontent.com/${index}?attempt=${attempt}`,
            file_id: `file-${index}-${attempt}`,
            ...(index === 0
              ? {}
              : {
                  file_name: `fixture-${index}.jpeg`,
                  mime_type: "image/jpeg",
                }),
          })),
        },
      },
    }),
  });
  expect(response.status).toBe(200);
  return response.json();
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("MCP photo storage round trip", () => {
  it("saves three portrait JPEGs as WebP attachments in one draft", async () => {
    const { app, storage } = await harness();
    const body = await importPhotos(app, await fixturePhotos());
    expect(body.result.structuredContent).toMatchObject({
      status: "saved",
      imageCount: 3,
      count: 1,
    });
    expect(storage.entries()).toHaveLength(1);
    const entry = storage.entries()[0]!;
    expect(entry.status).toBe("draft");
    expect(entry.images).toHaveLength(3);
    for (const image of entry.images) {
      const bytes = storage.objects.get(`test-state/${image.storageKey}`)!.body;
      expect(bytes).toBeInstanceOf(Uint8Array);
      const metadata = await sharp(bytes as Uint8Array).metadata();
      expect(metadata).toMatchObject({
        format: "webp",
        width: 1152,
        height: 1536,
      });
      expect(metadata.exif).toBeUndefined();
      expect(image.byteSize).toBeLessThanOrEqual(700 * 1024);
    }
  });

  it("repairs a partial photo save on retry without duplicating the draft or images", async () => {
    const { app, storage } = await harness();
    const photos = await fixturePhotos();
    storage.failImageWrite(2);
    const failed = await importPhotos(app, photos);
    expect(failed.result).toMatchObject({
      isError: true,
      structuredContent: {
        error: { code: "IMAGE_ATTACHMENT_FAILED", imageIndex: 1 },
        saveState: "possibly_partial",
      },
    });
    expect(storage.entries()[0]?.images).toHaveLength(1);
    const retried = await importPhotos(app, photos, 1);
    expect(retried.result.structuredContent).toMatchObject({
      status: "saved",
      imageCount: 3,
    });
    expect(storage.entries()).toHaveLength(1);
    expect(storage.entries()[0]?.images).toHaveLength(3);
    expect(
      [...storage.objects.values()].filter(
        ({ body }) => body instanceof Uint8Array,
      ),
    ).toHaveLength(3);
  });
});
