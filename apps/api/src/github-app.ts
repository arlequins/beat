import { createSign } from "node:crypto";

import { serverEnv } from "@acme/env/server-env";

type InstallationTokenResponse = { expires_at: string; token: string };

function base64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function required(value: string | undefined, name: string) {
  if (!value)
    throw new Error(`${name} is required for GitHub content automation`);
  return value;
}

export function createGitHubAppJwt(now = new Date()) {
  const appId = required(serverEnv.GITHUB_APP_ID, "GITHUB_APP_ID");
  const privateKey = required(
    serverEnv.GITHUB_APP_PRIVATE_KEY,
    "GITHUB_APP_PRIVATE_KEY",
  ).replace(/\\n/g, "\n");
  const issuedAt = Math.floor(now.getTime() / 1_000) - 60;
  const payload = base64Url(
    JSON.stringify({ exp: issuedAt + 9 * 60, iat: issuedAt, iss: appId }),
  );
  const signingInput = `${base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${payload}`;
  const signature = createSign("RSA-SHA256")
    .update(signingInput)
    .end()
    .sign(privateKey, "base64url");
  return `${signingInput}.${signature}`;
}

export async function createGitHubInstallationToken(
  request: typeof fetch = fetch,
) {
  const installationId = required(
    serverEnv.GITHUB_APP_INSTALLATION_ID,
    "GITHUB_APP_INSTALLATION_ID",
  );
  const response = await request(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      body: JSON.stringify({
        permissions: {
          contents: "write",
          metadata: "read",
          pull_requests: "write",
        },
      }),
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${createGitHubAppJwt()}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2026-03-10",
      },
      method: "POST",
    },
  );
  if (!response.ok)
    throw new Error(
      `GitHub installation token request failed (${response.status})`,
    );
  return (await response.json()) as InstallationTokenResponse;
}
