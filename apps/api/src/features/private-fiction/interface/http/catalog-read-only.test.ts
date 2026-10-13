import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const catalogKey = "author-vault/catalog.json";
const legacyKey = "author-vault/reality-error/outline.md";
const editionPath = "/admin/private-fictions/reality-error/editions/current";
const errors = [
  { name: "NoSuchKey" },
  { $metadata: { httpStatusCode: 404 } },
  { name: "AccessDenied" },
  { $metadata: { httpStatusCode: 403 } },
];

async function fixture(email: string, catalogError?: (typeof errors)[number]) {
  vi.stubEnv("PRIVATE_FICTION_BUCKET", "private-vault-bucket");
  const { createApiApp } = await import("../../../../app");
  const { createLogger } = await import("@arlequins/logger");
  const work = {
    id: "reality-error",
    title: "현실 오류",
    activeEditionId: "current",
    editions: [{ id: "current", label: "현재 판본" }],
    allowedSubjects: [],
    createdAt: "2026-10-13T00:00:00.000Z",
    updatedAt: "2026-10-13T00:00:00.000Z",
  };
  const commands: unknown[] = [];
  vi.spyOn(S3Client.prototype, "send").mockImplementation(async (command) => {
    commands.push(command);
    if (command instanceof GetObjectCommand) {
      if (command.input.Key === catalogKey && catalogError) throw catalogError;
      return {
        ETag: "stored",
        LastModified: new Date(work.updatedAt),
        Body: {
          transformToString: async () =>
            command.input.Key === catalogKey
              ? JSON.stringify({ works: [work] })
              : "# 1화\n\nLegacy reading fixture",
        },
      };
    }
    if (command instanceof PutObjectCommand) return { ETag: "initialized" };
    throw new Error("Unexpected S3 operation");
  });
  const app = createApiApp({
    corsOrigins: [],
    logger: createLogger({ service: "api", sink: () => {} }),
    rateLimiter: false,
    beatAuth: {
      authenticate: vi.fn(),
      issueTokenPair: vi.fn(),
      jwks: vi.fn(async () => ({ keys: [] })),
      refreshTokenPair: vi.fn(),
      revokeRefreshToken: vi.fn(),
      verifyAccessToken: vi.fn(async () => ({ email, subject: "account-id" })),
    },
  });
  return { app, commands, headers: { Authorization: "Bearer verified-token" } };
}

describe("private catalog GET through the real S3 repository", () => {
  for (const path of ["/admin/private-fictions", editionPath]) {
    it.each(errors)(
      `does not initialize a reader catalog on ${path} after %j`,
      async (error) => {
        const { app, commands, headers } = await fixture(
          "beat.lumen@gmail.com",
          error,
        );
        const response = await app.request(path, { headers });
        const missing =
          error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404;
        expect(response.status).toBe(
          missing ? (path === editionPath ? 404 : 200) : 503,
        );
        if (missing && path !== editionPath)
          await expect(response.json()).resolves.toEqual({
            etag: null,
            works: [],
          });
        expect(commands).toHaveLength(1);
        expect(commands[0]).toBeInstanceOf(GetObjectCommand);
        expect((commands[0] as GetObjectCommand).input.Key).toBe(catalogKey);
        expect(
          commands.some((command) => command instanceof PutObjectCommand),
        ).toBe(false);
      },
    );

    it.each(errors)(
      `preserves owner catalog initialization on ${path} after %j`,
      async (error) => {
        const { app, commands, headers } = await fixture(
          "tiret.rouge@gmail.com",
          error,
        );
        expect((await app.request(path, { headers })).status).toBe(200);
        const writes = commands.filter(
          (command): command is PutObjectCommand =>
            command instanceof PutObjectCommand,
        );
        expect(writes).toHaveLength(1);
        expect(writes[0]!.input).toMatchObject({
          Key: catalogKey,
          IfNoneMatch: "*",
        });
        expect(
          commands.some(
            (command) =>
              command instanceof GetObjectCommand &&
              command.input.Key === legacyKey,
          ),
        ).toBe(true);
      },
    );

    it(`reads an existing catalog and body without writing on ${path}`, async () => {
      const { app, commands, headers } = await fixture("beat.lumen@gmail.com");
      const response = await app.request(path, { headers });
      expect(response.status).toBe(200);
      const body = await response.json();
      if (path === editionPath)
        expect(body.source).toContain("Legacy reading fixture");
      else expect(body.works[0].id).toBe("reality-error");
      expect(
        commands.every((command) => command instanceof GetObjectCommand),
      ).toBe(true);
      expect(
        commands.some((command) => command instanceof PutObjectCommand),
      ).toBe(false);
    });
  }
});
