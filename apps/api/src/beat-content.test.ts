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
  const commands: unknown[] = [];
  let version = 0;
  const send = vi.fn(async (command: unknown) => {
    commands.push(command);
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
      objects.set(key, {
        body: String(input.Body),
        etag: `"v${version}"`,
      });
      return {};
    }
    throw new Error("unexpected command");
  });
  return {
    client: { send } as unknown as S3Client,
    commands,
    objects,
  };
}

async function loadContent() {
  vi.stubEnv("BEAT_AUTH_STATE_BUCKET", "beat-state");
  vi.stubEnv("BEAT_AUTH_LEDGER_BUCKET", "beat-ledger");
  vi.stubEnv("BEAT_AUTH_STATE_PREFIX", "v1");
  vi.stubEnv("BEAT_AUTH_LEDGER_RETENTION_DAYS", "365");
  vi.stubEnv("GITHUB_CONTENT_REPOSITORY", "arlequins/beat");
  vi.resetModules();
  vi.doMock("./github-app", () => ({
    createGitHubInstallationToken: vi.fn(async () => ({
      expires_at: "2026-07-30T01:00:00.000Z",
      token: "installation-token",
    })),
  }));
  return import("./beat-content");
}

afterEach(() => {
  vi.doUnmock("./github-app");
  vi.unstubAllEnvs();
});

describe("Beat S3 content", () => {
  it("saves immutable revisions and detects stale updates", async () => {
    const harness = s3Harness();
    const content = await loadContent();
    const first = await content.saveBeatDraft(
      {
        expectedRevision: 0,
        slug: "weekly-test",
        source: "---\ntitle: Test\n---\n\nDraft",
        title: "Test",
        updatedBy: "admin-1",
      },
      harness.client,
    );
    expect(first).toMatchObject({ revision: 1, status: "draft" });
    await expect(
      content.getBeatDraft("weekly-test", harness.client),
    ).resolves.toMatchObject({
      revision: 1,
      source: expect.stringContaining("Draft"),
    });
    const second = await content.saveBeatDraft(
      {
        expectedRevision: 1,
        slug: "weekly-test",
        source: "---\ntitle: Updated\n---\n\nUpdated",
        title: "Updated",
        updatedBy: "admin-2",
      },
      harness.client,
    );
    expect(second.revision).toBe(2);
    await expect(
      content.saveBeatDraft(
        {
          expectedRevision: 0,
          slug: "weekly-test",
          source: "---\ntitle: Stale\n---\n\nStale",
          title: "Stale",
          updatedBy: "admin-2",
        },
        harness.client,
      ),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(
      [...harness.objects.keys()].some((key) =>
        key.includes("/drafts/weekly-test/revisions/1.json"),
      ),
    ).toBe(true);
    const ledgerPut = harness.commands.find(
      (command) =>
        command instanceof PutObjectCommand &&
        command.input.Bucket === "beat-ledger",
    ) as PutObjectCommand;
    expect(ledgerPut.input.ObjectLockMode).toBe("COMPLIANCE");
  });

  it("lists revision metadata and restores an older revision as a new head", async () => {
    const harness = s3Harness();
    const content = await loadContent();
    await content.saveBeatDraft(
      {
        expectedRevision: 0,
        slug: "history-test",
        source: "---\ntitle: First\n---\n\nFirst body",
        title: "First",
        updatedBy: "admin-1",
      },
      harness.client,
    );
    await content.saveBeatDraft(
      {
        expectedRevision: 1,
        slug: "history-test",
        source: "---\ntitle: Second\n---\n\nSecond body",
        title: "Second",
        updatedBy: "admin-2",
      },
      harness.client,
    );

    await expect(
      content.listBeatDraftRevisions("history-test", harness.client),
    ).resolves.toEqual([
      expect.objectContaining({
        revision: 2,
        sourceBytes: expect.any(Number),
        title: "Second",
        updatedBy: "admin-2",
      }),
      expect.objectContaining({ revision: 1, title: "First" }),
    ]);
    await expect(
      content.getBeatDraftRevision("history-test", 1, harness.client),
    ).resolves.toMatchObject({
      revision: 1,
      source: expect.stringContaining("First body"),
    });

    const restored = await content.restoreBeatDraftRevision(
      {
        expectedRevision: 2,
        revision: 1,
        slug: "history-test",
        updatedBy: "admin-3",
      },
      harness.client,
    );
    expect(restored).toMatchObject({
      revision: 3,
      source: expect.stringContaining("First body"),
      status: "draft",
      title: "First",
      updatedBy: "admin-3",
    });
    await expect(
      content.restoreBeatDraftRevision(
        {
          expectedRevision: 2,
          revision: 1,
          slug: "history-test",
          updatedBy: "admin-3",
        },
        harness.client,
      ),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(
      [...harness.objects.values()].some(({ body }) =>
        body.includes('"type":"draft-restored"'),
      ),
    ).toBe(true);
  });

  it("confirms a draft and opens one idempotent GitHub pull request", async () => {
    const harness = s3Harness();
    const content = await loadContent();
    await content.saveBeatDraft(
      {
        expectedRevision: 0,
        slug: "weekly-test",
        source: "---\ntitle: Test\nreviewStatus: reviewed\n---\n\nFinal",
        title: "Test",
        updatedBy: "admin-1",
      },
      harness.client,
    );
    const request = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/git/ref/heads/main"))
        return Response.json({ object: { sha: "main-sha" } });
      if (url.endsWith("/git/refs")) return Response.json({}, { status: 422 });
      if (url.includes("/contents/") && init?.method !== "PUT")
        return Response.json({ sha: "existing-sha" });
      if (url.includes("/contents/") && init?.method === "PUT") {
        expect(JSON.parse(String(init.body))).toMatchObject({
          sha: "existing-sha",
        });
        return Response.json({}, { status: 201 });
      }
      if (url.endsWith("/pulls")) return Response.json({}, { status: 422 });
      if (url.includes("/pulls?state=open"))
        return Response.json([
          { html_url: "https://github.com/arlequins/beat/pull/10" },
        ]);
      throw new Error(`unexpected GitHub request ${url}`);
    }) as typeof fetch;
    const opened = await content.confirmAndPublishBeatDraft(
      {
        expectedRevision: 1,
        slug: "weekly-test",
        subject: "admin-1",
      },
      harness.client,
      request,
    );
    expect(opened).toMatchObject({
      draftRevision: 2,
      prUrl: "https://github.com/arlequins/beat/pull/10",
      status: "opened",
    });
    const repeated = await content.confirmAndPublishBeatDraft(
      {
        expectedRevision: 2,
        slug: "weekly-test",
        subject: "admin-1",
      },
      harness.client,
      request,
    );
    expect(repeated.prUrl).toBe(opened.prUrl);
    expect(request).toHaveBeenCalledTimes(6);
  });

  it("rejects unsafe slugs and malformed MDX", async () => {
    const harness = s3Harness();
    const content = await loadContent();
    await expect(
      content.saveBeatDraft(
        {
          expectedRevision: 0,
          slug: "../secrets",
          source: "not-mdx",
          title: "",
          updatedBy: "admin-1",
        },
        harness.client,
      ),
    ).rejects.toMatchObject({ code: "invalid_draft" });
    await expect(
      content.getBeatDraft("../secrets", harness.client),
    ).rejects.toMatchObject({ code: "invalid_draft" });
    await expect(
      content.getBeatDraft("missing", harness.client),
    ).resolves.toBeUndefined();
    await expect(
      content.confirmAndPublishBeatDraft(
        {
          expectedRevision: 1,
          slug: "missing",
          subject: "admin-1",
        },
        harness.client,
      ),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("lists repository posts and lets S3 drafts override their source record", async () => {
    const harness = s3Harness();
    const content = await loadContent();
    const source =
      "---\ntitle: Weekly Test\ncategory: weekly\npublishedAt: 2026-08-01\nreviewStatus: reviewed\n---\n\nPublished";
    const request = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("/contents/apps/web/content/posts?"))
        return Response.json([{ name: "weekly-test.mdx", type: "file" }]);
      if (url.includes("/contents/apps/web/content/posts/weekly-test.mdx?"))
        return Response.json({
          content: Buffer.from(source).toString("base64"),
        });
      throw new Error(`unexpected GitHub request ${url}`);
    }) as typeof fetch;

    await expect(
      content.listBeatContentRecords(harness.client, request),
    ).resolves.toEqual([
      {
        category: "weekly",
        origin: "repository",
        publishedAt: "2026-08-01",
        reviewStatus: "reviewed",
        revision: 0,
        slug: "weekly-test",
        status: "published",
        title: "Weekly Test",
      },
    ]);

    await content.saveBeatDraft(
      {
        expectedRevision: 0,
        slug: "weekly-test",
        source: "---\ntitle: Draft\n---\n\nDraft",
        title: "Draft",
        updatedBy: "admin-1",
      },
      harness.client,
    );
    await expect(
      content.listBeatContentRecords(harness.client, request),
    ).resolves.toEqual([
      expect.objectContaining({
        origin: "draft",
        revision: 1,
        slug: "weekly-test",
        status: "draft",
        title: "Draft",
      }),
    ]);
    await expect(
      content.getBeatContentDraft("weekly-test", harness.client, request),
    ).resolves.toMatchObject({ origin: "draft", revision: 1 });
  });

  it("ignores unsupported repository entries and reports lookup failures", async () => {
    const harness = s3Harness();
    const content = await loadContent();
    harness.objects.set("beat-state/v1/drafts/not safe/head.json", {
      body: "{}",
      etag: '"invalid-slug"',
    });
    harness.objects.set("beat-state/v1/drafts/invalid/head.json", {
      body: JSON.stringify({ schemaVersion: 1 }),
      etag: '"invalid-draft"',
    });
    const request = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("/contents/apps/web/content/posts?"))
        return Response.json([
          { name: "README.md", type: "file" },
          { name: "nested.mdx", type: "dir" },
          { name: "BAD_NAME.mdx", type: "file" },
          { name: "missing.mdx", type: "file" },
          { name: "untitled.mdx", type: "file" },
        ]);
      if (url.includes("/missing.mdx?"))
        return Response.json({ message: "Not Found" }, { status: 404 });
      if (url.includes("/untitled.mdx?"))
        return Response.json({
          content: Buffer.from("Body only").toString("base64"),
        });
      if (url.includes("/empty.mdx?")) return Response.json({});
      throw new Error(`unexpected GitHub request ${url}`);
    }) as typeof fetch;

    const records = await content.listBeatContentRecords(
      harness.client,
      request,
    );
    expect(records).toEqual([
      {
        category: undefined,
        origin: "repository",
        publishedAt: undefined,
        revision: 0,
        slug: "untitled",
        status: "published",
        title: "untitled",
      },
    ]);
    await expect(
      content.getBeatRepositoryPost("missing", request),
    ).resolves.toBeUndefined();
    await expect(
      content.getBeatRepositoryPost("empty", request),
    ).rejects.toThrow("GitHub content lookup failed");
  });

  it("rejects an unavailable repository index", async () => {
    const harness = s3Harness();
    const content = await loadContent();
    const request = vi.fn(async (input: string | URL) => {
      if (String(input).includes("/contents/apps/web/content/posts?"))
        return Response.json({ message: "Unavailable" }, { status: 503 });
      throw new Error(`unexpected GitHub request ${String(input)}`);
    }) as typeof fetch;

    await expect(
      content.listBeatContentRecords(harness.client, request),
    ).rejects.toThrow("GitHub content index failed");
  });

  it("replays pending publication jobs and records merged pull requests", async () => {
    const harness = s3Harness();
    const content = await loadContent();
    await content.saveBeatDraft(
      {
        expectedRevision: 0,
        slug: "reconcile-test",
        source: "---\ntitle: Test\nreviewStatus: reviewed\n---\n\nFinal",
        title: "Test",
        updatedBy: "admin-1",
      },
      harness.client,
    );
    const publishingRequest = vi.fn(
      async (input: string | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/git/ref/heads/main"))
          return Response.json({ object: { sha: "main-sha" } });
        if (url.endsWith("/git/refs"))
          return Response.json({}, { status: 201 });
        if (url.includes("/contents/") && init?.method !== "PUT")
          return Response.json({}, { status: 404 });
        if (url.includes("/contents/") && init?.method === "PUT")
          return Response.json({}, { status: 201 });
        if (url.endsWith("/pulls"))
          return Response.json({
            html_url: "https://github.com/arlequins/beat/pull/20",
          });
        throw new Error(`unexpected GitHub request ${url}`);
      },
    ) as typeof fetch;
    const opened = await content.confirmAndPublishBeatDraft(
      {
        expectedRevision: 1,
        slug: "reconcile-test",
        subject: "admin-1",
      },
      harness.client,
      publishingRequest,
    );
    expect(opened.status).toBe("opened");

    const mergedRequest = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.endsWith("/pulls/20"))
        return Response.json({
          merged_at: "2026-08-06T00:00:00.000Z",
          state: "closed",
        });
      throw new Error(`unexpected GitHub request ${url}`);
    }) as typeof fetch;
    const summary = await content.reconcileBeatPublicationJobs(
      harness.client,
      mergedRequest,
    );
    expect(summary).toMatchObject({
      checked: 1,
      failures: [],
      merged: 1,
    });
    const repeated = await content.reconcileBeatPublicationJobs(
      harness.client,
      mergedRequest,
    );
    expect(repeated).toMatchObject({ checked: 1, merged: 0 });
    expect(mergedRequest).toHaveBeenCalledTimes(1);
  });
});
