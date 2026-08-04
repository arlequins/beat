import { generateKeyPairSync } from "node:crypto";

import { jwtVerify } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";

async function loadGitHubApp() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  vi.stubEnv("GITHUB_APP_ID", "123456");
  vi.stubEnv("GITHUB_APP_INSTALLATION_ID", "987654");
  vi.stubEnv(
    "GITHUB_APP_PRIVATE_KEY",
    privateKey.export({ format: "pem", type: "pkcs1" }).toString(),
  );
  vi.resetModules();
  return { github: await import("./github-app"), publicKey };
}

afterEach(() => vi.unstubAllEnvs());

describe("GitHub App authentication", () => {
  it("signs a short-lived app JWT and requests a scoped installation token", async () => {
    const { github, publicKey } = await loadGitHubApp();
    const now = new Date("2026-07-30T00:00:00.000Z");
    const jwt = github.createGitHubAppJwt(now);
    await expect(
      jwtVerify(jwt, publicKey, {
        algorithms: ["RS256"],
        currentDate: now,
        issuer: "123456",
      }),
    ).resolves.toMatchObject({
      payload: {
        exp: Math.floor(now.getTime() / 1_000) + 8 * 60,
        iss: "123456",
      },
    });

    const request = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) => {
        expect(init?.headers).toMatchObject({
          Authorization: expect.stringMatching(/^Bearer /),
        });
        expect(JSON.parse(String(init?.body))).toMatchObject({
          permissions: {
            contents: "write",
            metadata: "read",
            pull_requests: "write",
          },
        });
        return Response.json({
          expires_at: "2026-07-30T01:00:00.000Z",
          token: "installation-token",
        });
      },
    ) as typeof fetch;
    await expect(
      github.createGitHubInstallationToken(request),
    ).resolves.toMatchObject({ token: "installation-token" });
  });

  it("does not hide GitHub installation-token failures", async () => {
    const { github } = await loadGitHubApp();
    const request = vi.fn(
      async () => new Response("unavailable", { status: 503 }),
    ) as typeof fetch;
    await expect(github.createGitHubInstallationToken(request)).rejects.toThrow(
      "GitHub installation token request failed (503)",
    );
  });
});
