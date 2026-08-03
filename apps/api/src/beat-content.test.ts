import {
  GetObjectCommand,
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
          Key: string;
        };
      }
    ).input;
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
});
