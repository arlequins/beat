import assert from "node:assert/strict";
import test from "node:test";

import { runApiSmokeChecks } from "./smoke-api.mjs";

const origin = "https://arlequins.github.io";
const baseUrl = "https://api.example.com";

function json(body, status = 200, cors = origin) {
  return Response.json(body, {
    headers: cors ? { "Access-Control-Allow-Origin": cors } : undefined,
    status,
  });
}

function validRequest(overrides = {}) {
  return async (input) => {
    const url = String(input);
    if (url.endsWith("/health/live") || url.endsWith("/health/ready"))
      return json({ status: "ok" }, 200, undefined);
    if (url.endsWith("/auth/.well-known/openid-configuration"))
      return json({
        authorization_endpoint: `${baseUrl}/auth/authorize`,
        code_challenge_methods_supported: ["S256"],
        end_session_endpoint: `${baseUrl}/auth/logout`,
        grant_types_supported: ["authorization_code", "refresh_token"],
        id_token_signing_alg_values_supported: ["ES256"],
        issuer: `${baseUrl}/auth`,
        jwks_uri: `${baseUrl}/auth/jwks`,
        revocation_endpoint: `${baseUrl}/auth/revoke`,
        scopes_supported: ["openid", "offline_access"],
        token_endpoint: `${baseUrl}/auth/token`,
        ...overrides.discovery,
      });
    if (url.endsWith("/auth/jwks"))
      return json({ keys: [{ alg: "ES256", kty: "EC" }] });
    if (url.endsWith("/admin/content")) return json({}, 401);
    if (url.includes("/api/gourmet/entries")) return json({ entries: [] });
    throw new Error(`Unexpected request ${url}`);
  };
}

test("checks the production browser and data contracts", async () => {
  await assert.doesNotReject(
    runApiSmokeChecks(baseUrl, validRequest(), origin),
  );
});

test("rejects duplicate CORS origins and missing refresh scope", async () => {
  const duplicateCors = validRequest();
  await assert.rejects(
    runApiSmokeChecks(
      baseUrl,
      async (input, init) => {
        const response = await duplicateCors(input, init);
        if (String(input).includes("openid-configuration"))
          response.headers.set(
            "Access-Control-Allow-Origin",
            `${origin}, ${origin}`,
          );
        return response;
      },
      origin,
    ),
    /invalid Access-Control-Allow-Origin/,
  );
  await assert.rejects(
    runApiSmokeChecks(
      baseUrl,
      validRequest({ discovery: { scopes_supported: ["openid"] } }),
      origin,
    ),
    /offline_access/,
  );
});
