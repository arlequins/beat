import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllEnvs());

function client(send: (command: unknown) => Promise<unknown>) {
  return { send } as never;
}

describe("private fiction S3 repository", () => {
  it("reads only the fixed private object and maps metadata", async () => {
    vi.stubEnv("PRIVATE_FICTION_BUCKET", "private-vault-bucket");
    const { getPrivateFictionDocument } = await import(
      "./s3-private-fiction-repository"
    );
    const send = vi.fn(async (command: unknown) => {
      expect(command).toBeInstanceOf(GetObjectCommand);
      expect((command as GetObjectCommand).input).toMatchObject({
        Bucket: "private-vault-bucket",
        Key: "author-vault/reality-error/outline.md",
      });
      return {
        Body: { transformToString: async () => "# local outline" },
        ETag: '"etag-1"',
        LastModified: new Date("2026-09-27T00:00:00.000Z"),
      };
    });

    await expect(getPrivateFictionDocument(client(send))).resolves.toEqual({
      etag: '"etag-1"',
      source: "# local outline",
      updatedAt: "2026-09-27T00:00:00.000Z",
    });
  });

  it("distinguishes a missing object from unreadable objects and storage errors", async () => {
    vi.stubEnv("PRIVATE_FICTION_BUCKET", "private-vault-bucket");
    const { getPrivateFictionDocument, PrivateFictionStorageError } =
      await import("./s3-private-fiction-repository");
    await expect(
      getPrivateFictionDocument(
        client(async () => {
          throw { name: "NoSuchKey" };
        }),
      ),
    ).resolves.toBeUndefined();
    await expect(
      getPrivateFictionDocument(
        client(async () => ({ ETag: '"etag"', Body: "not a stream" })),
      ),
    ).rejects.toBeInstanceOf(PrivateFictionStorageError);
    await expect(
      getPrivateFictionDocument(
        client(async () => {
          throw new Error("network failure");
        }),
      ),
    ).rejects.toMatchObject({ code: "storage_unavailable" });
    await expect(
      getPrivateFictionDocument(client(async () => ({ Body: "body" }))),
    ).rejects.toMatchObject({ code: "storage_unavailable" });
  });

  it("writes with no-store metadata and conditional create or update", async () => {
    vi.stubEnv("PRIVATE_FICTION_BUCKET", "private-vault-bucket");
    const { savePrivateFictionDocument } = await import(
      "./s3-private-fiction-repository"
    );
    const send = vi.fn(async (command: unknown) => {
      expect(command).toBeInstanceOf(PutObjectCommand);
      return { ETag: '"etag-2"' };
    });

    const created = await savePrivateFictionDocument(
      { expectedEtag: null, source: "# outline" },
      client(send),
    );
    expect(created.etag).toBe('"etag-2"');
    const createCall = send.mock.calls[0];
    if (!createCall) throw new Error("expected create call");
    expect((createCall[0] as PutObjectCommand).input).toMatchObject({
      Bucket: "private-vault-bucket",
      CacheControl: "private, no-store, max-age=0",
      ContentType: "text/markdown; charset=utf-8",
      IfNoneMatch: "*",
      Key: "author-vault/reality-error/outline.md",
    });
    await savePrivateFictionDocument(
      { expectedEtag: '"etag-1"', source: "# revised" },
      client(send),
    );
    const updateCall = send.mock.calls[1];
    if (!updateCall) throw new Error("expected update call");
    expect((updateCall[0] as PutObjectCommand).input.IfMatch).toBe('"etag-1"');
  });

  it("maps precondition failures and missing configuration to safe errors", async () => {
    vi.stubEnv("PRIVATE_FICTION_BUCKET", "private-vault-bucket");
    const { savePrivateFictionDocument } = await import(
      "./s3-private-fiction-repository"
    );
    await expect(
      savePrivateFictionDocument(
        { expectedEtag: null, source: "draft" },
        client(async () => {
          throw { $metadata: { httpStatusCode: 412 } };
        }),
      ),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      savePrivateFictionDocument(
        { expectedEtag: null, source: "draft" },
        client(async () => ({})),
      ),
    ).rejects.toMatchObject({ code: "storage_unavailable" });
    await expect(
      savePrivateFictionDocument(
        { expectedEtag: null, source: "x".repeat(750_001) },
        client(async () => ({})),
      ),
    ).rejects.toMatchObject({ code: "storage_unavailable" });
    vi.stubEnv("PRIVATE_FICTION_BUCKET", "");
    vi.resetModules();
    const { getPrivateFictionDocument: getWithoutBucket } = await import(
      "./s3-private-fiction-repository"
    );
    await expect(
      getWithoutBucket(client(async () => ({}))),
    ).rejects.toMatchObject({ code: "storage_unavailable" });
  });
});
