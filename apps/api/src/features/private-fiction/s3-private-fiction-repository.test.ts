import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllEnvs());

function client(send: (command: unknown) => Promise<unknown>) {
  return { send } as never;
}

describe("private fiction S3 repository", () => {
  it("initializes a missing catalog without overwriting the legacy work", async () => {
    vi.stubEnv("PRIVATE_FICTION_BUCKET", "private-vault-bucket");
    const { getPrivateFictionCatalog } = await import(
      "./s3-private-fiction-repository"
    );
    const send = vi.fn(async (command: unknown) => {
      if (command instanceof GetObjectCommand) {
        if (command.input.Key === "author-vault/catalog.json")
          throw { name: "AccessDenied" };
        return {
          ETag: "legacy",
          LastModified: new Date(),
          Body: { transformToString: async () => "legacy text" },
        };
      }
      expect(command).toBeInstanceOf(PutObjectCommand);
      const input = (command as PutObjectCommand).input;
      expect(input.Key).toBe("author-vault/catalog.json");
      expect(input.IfNoneMatch).toBe("*");
      expect(JSON.parse(String(input.Body)).works[0].id).toBe("reality-error");
      return { ETag: "catalog" };
    });
    expect(
      (await getPrivateFictionCatalog(client(send))).works[0]?.activeEditionId,
    ).toBe("current");
  });

  it("uses separate conditional objects for editions and annotations", async () => {
    vi.stubEnv("PRIVATE_FICTION_BUCKET", "private-vault-bucket");
    const { savePrivateFictionEdition, savePrivateFictionEditionAnnotations } =
      await import("./s3-private-fiction-repository");
    const send = vi.fn(async (_command: unknown) => ({ ETag: "saved" }));
    await savePrivateFictionEdition(
      "book-a",
      "first",
      { expectedEtag: null, source: "Text" },
      client(send),
    );
    await savePrivateFictionEditionAnnotations(
      "book-b",
      "second",
      { expectedEtag: "previous", annotations: [] },
      client(send),
    );
    expect((send.mock.calls[0]![0] as PutObjectCommand).input).toMatchObject({
      Key: "author-vault/works/book-a/editions/first/outline.md",
      IfNoneMatch: "*",
    });
    expect((send.mock.calls[1]![0] as PutObjectCommand).input).toMatchObject({
      Key: "author-vault/works/book-b/editions/second/annotations.json",
      IfMatch: "previous",
    });
  });

  it("initializes absent feedback when least-privilege S3 reads report 403", async () => {
    vi.stubEnv("PRIVATE_FICTION_BUCKET", "private-vault-bucket");
    const { getPrivateFictionAnnotations } = await import(
      "./s3-private-fiction-repository"
    );
    let stored: string | undefined;
    let writes = 0;
    const send = async (command: unknown) => {
      if (command instanceof GetObjectCommand) {
        if (!stored)
          throw { name: "AccessDenied", $metadata: { httpStatusCode: 403 } };
        return {
          Body: { transformToString: async () => stored! },
          ETag: '"empty-feedback"',
          LastModified: new Date("2026-10-07T00:00:00Z"),
        };
      }
      if (!(command instanceof PutObjectCommand))
        throw new Error("Unexpected S3 operation");
      expect(command.input).toMatchObject({
        Bucket: "private-vault-bucket",
        Key: "author-vault/reality-error/annotations.json",
        IfNoneMatch: "*",
      });
      if (stored) throw { $metadata: { httpStatusCode: 412 } };
      stored = String(command.input.Body);
      writes += 1;
      return { ETag: '"empty-feedback"' };
    };
    await expect(
      getPrivateFictionAnnotations(client(send)),
    ).resolves.toMatchObject({ annotations: [], etag: '"empty-feedback"' });
    await expect(
      getPrivateFictionAnnotations(client(send)),
    ).resolves.toMatchObject({ annotations: [], etag: '"empty-feedback"' });
    expect(writes).toBe(1);
  });

  it("preserves feedback created by another request during initialization", async () => {
    vi.stubEnv("PRIVATE_FICTION_BUCKET", "private-vault-bucket");
    const { getPrivateFictionAnnotations } = await import(
      "./s3-private-fiction-repository"
    );
    const existing = {
      annotations: [{ id: "original", comment: "Keep this feedback" }],
    };
    let reads = 0;
    const send = async (command: unknown) => {
      if (command instanceof GetObjectCommand) {
        if (++reads === 1) throw { name: "AccessDenied" };
        return {
          Body: { transformToString: async () => JSON.stringify(existing) },
          ETag: '"existing-feedback"',
          LastModified: new Date("2026-10-07T00:00:00Z"),
        };
      }
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect((command as PutObjectCommand).input.IfNoneMatch).toBe("*");
      throw { $metadata: { httpStatusCode: 412 } };
    };
    await expect(
      getPrivateFictionAnnotations(client(send)),
    ).resolves.toMatchObject({
      annotations: existing.annotations,
      etag: '"existing-feedback"',
    });
  });

  it.each([403, 412])(
    "does not report unreadable existing feedback as empty after initialization status %s",
    async (status) => {
      vi.stubEnv("PRIVATE_FICTION_BUCKET", "private-vault-bucket");
      const { getPrivateFictionAnnotations } = await import(
        "./s3-private-fiction-repository"
      );
      const send = async (command: unknown) => {
        throw {
          $metadata: {
            httpStatusCode: command instanceof GetObjectCommand ? 403 : status,
          },
        };
      };
      await expect(
        getPrivateFictionAnnotations(client(send)),
      ).rejects.toMatchObject({ code: "storage_unavailable" });
    },
  );
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

  it("reads and conditionally writes owner feedback in its separate private object", async () => {
    vi.stubEnv("PRIVATE_FICTION_BUCKET", "private-vault-bucket");
    const { getPrivateFictionAnnotations, savePrivateFictionAnnotations } =
      await import("./s3-private-fiction-repository");
    const annotations = [
      {
        id: "6c87c47a-d0f6-4425-a017-872b7deabc02",
        episode: 1,
        blockIndex: 0,
        startOffset: 0,
        endOffset: 4,
        quote: "첫 문장",
        prefix: "",
        suffix: " 뒤 문장",
        comment: "이 부분을 조금 다듬어 주세요.",
        createdAt: "2026-09-29T00:00:00.000Z",
      },
    ];
    const readSend = vi.fn(async (command: unknown) => {
      expect(command).toBeInstanceOf(GetObjectCommand);
      expect((command as GetObjectCommand).input).toMatchObject({
        Bucket: "private-vault-bucket",
        Key: "author-vault/reality-error/annotations.json",
      });
      return {
        Body: {
          transformToString: async () => JSON.stringify({ annotations }),
        },
        ETag: '"feedback-1"',
        LastModified: new Date("2026-09-29T00:00:00.000Z"),
      };
    });
    await expect(
      getPrivateFictionAnnotations(client(readSend)),
    ).resolves.toEqual({
      etag: '"feedback-1"',
      annotations,
      updatedAt: "2026-09-29T00:00:00.000Z",
    });

    const writeSend = vi.fn(async (command: unknown) => {
      expect(command).toBeInstanceOf(PutObjectCommand);
      return { ETag: '"feedback-2"' };
    });
    const saved = await savePrivateFictionAnnotations(
      { expectedEtag: '"feedback-1"', annotations },
      client(writeSend),
    );
    expect(saved).toMatchObject({ etag: '"feedback-2"', annotations });
    const command = writeSend.mock.calls[0]?.[0] as PutObjectCommand;
    expect(command.input).toMatchObject({
      Bucket: "private-vault-bucket",
      CacheControl: "private, no-store, max-age=0",
      ContentType: "application/json; charset=utf-8",
      IfMatch: '"feedback-1"',
      Key: "author-vault/reality-error/annotations.json",
    });
    expect(command.input.Body).toBe(JSON.stringify({ annotations }));
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
        { expectedEtag: null, source: "x".repeat(4_000_001) },
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

  it("accepts the multi-megabyte manuscript needed for the private reader", async () => {
    vi.stubEnv("PRIVATE_FICTION_BUCKET", "private-vault-bucket");
    vi.resetModules();
    const { savePrivateFictionDocument } = await import(
      "./s3-private-fiction-repository"
    );
    const send = vi.fn(async () => ({ ETag: '"etag-large"' }));

    await expect(
      savePrivateFictionDocument(
        { expectedEtag: '"etag-1"', source: "x".repeat(2_200_000) },
        client(send),
      ),
    ).resolves.toMatchObject({ etag: '"etag-large"' });
    expect(send).toHaveBeenCalledOnce();
  });
});
