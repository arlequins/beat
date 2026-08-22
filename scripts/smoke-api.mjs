#!/usr/bin/env node
import { pathToFileURL } from "node:url";

const DEFAULT_WEB_ORIGIN = "https://arlequins.github.io";

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

async function responseJson(response, path) {
  try {
    return await response.json();
  } catch {
    throw new Error(`${path} did not return JSON`);
  }
}

function requireCors(response, path, webOrigin) {
  const allowedOrigin = response.headers.get("access-control-allow-origin");
  requireValue(
    allowedOrigin === webOrigin,
    `${path} returned invalid Access-Control-Allow-Origin: ${allowedOrigin ?? "missing"}`,
  );
}

export async function runApiSmokeChecks(
  rawBaseUrl,
  request = fetch,
  webOrigin = DEFAULT_WEB_ORIGIN,
) {
  const baseUrl = rawBaseUrl?.replace(/\/+$/, "");
  if (!baseUrl) throw new Error("Beat API URL is required");
  const parsedBaseUrl = new URL(baseUrl);
  requireValue(
    parsedBaseUrl.protocol === "https:" ||
      parsedBaseUrl.hostname === "localhost",
    "Beat API URL must use HTTPS outside localhost",
  );

  for (const path of ["/health/live", "/health/ready"]) {
    const response = await request(`${baseUrl}${path}`, {
      signal: AbortSignal.timeout(10_000),
    });
    requireValue(response.ok, `${path} returned ${response.status}`);
    const body = await responseJson(response, path);
    requireValue(body.status === "ok", `${path} did not return ok`);
  }

  const discoveryPath = "/auth/.well-known/openid-configuration";
  const discoveryResponse = await request(`${baseUrl}${discoveryPath}`, {
    headers: { Origin: webOrigin },
    signal: AbortSignal.timeout(10_000),
  });
  requireValue(
    discoveryResponse.ok,
    `${discoveryPath} returned ${discoveryResponse.status}`,
  );
  requireCors(discoveryResponse, discoveryPath, webOrigin);
  const discovery = await responseJson(discoveryResponse, discoveryPath);
  const issuer = `${baseUrl}/auth`;
  const expected = {
    authorization_endpoint: `${issuer}/authorize`,
    end_session_endpoint: `${issuer}/logout`,
    issuer,
    jwks_uri: `${issuer}/jwks`,
    revocation_endpoint: `${issuer}/revoke`,
    token_endpoint: `${issuer}/token`,
  };
  for (const [field, value] of Object.entries(expected))
    requireValue(
      discovery[field] === value,
      `${field} does not match ${value}`,
    );
  requireValue(
    discovery.code_challenge_methods_supported?.includes("S256"),
    "OIDC discovery does not require S256 PKCE",
  );
  requireValue(
    discovery.grant_types_supported?.includes("authorization_code") &&
      discovery.grant_types_supported?.includes("refresh_token"),
    "OIDC discovery does not expose authorization code and refresh grants",
  );
  requireValue(
    discovery.id_token_signing_alg_values_supported?.includes("ES256"),
    "OIDC discovery does not expose ES256",
  );
  requireValue(
    discovery.scopes_supported?.includes("offline_access"),
    "OIDC discovery does not expose offline_access",
  );

  const jwksResponse = await request(discovery.jwks_uri, {
    headers: { Origin: webOrigin },
    signal: AbortSignal.timeout(10_000),
  });
  requireValue(jwksResponse.ok, `/auth/jwks returned ${jwksResponse.status}`);
  requireCors(jwksResponse, "/auth/jwks", webOrigin);
  const jwks = await responseJson(jwksResponse, "/auth/jwks");
  requireValue(
    Array.isArray(jwks.keys) &&
      jwks.keys.some((key) => key?.alg === "ES256" && key?.kty === "EC"),
    "JWKS does not contain an ES256 signing key",
  );

  const adminResponse = await request(`${baseUrl}/admin/content`, {
    headers: { Origin: webOrigin },
    signal: AbortSignal.timeout(10_000),
  });
  requireValue(
    adminResponse.status === 401,
    `Unauthenticated admin content returned ${adminResponse.status}`,
  );
  requireCors(adminResponse, "/admin/content", webOrigin);

  const gourmetPath = "/api/gourmet/entries?page=1&pageSize=1";
  const gourmetResponse = await request(`${baseUrl}${gourmetPath}`, {
    headers: { Origin: webOrigin },
    signal: AbortSignal.timeout(10_000),
  });
  requireValue(
    gourmetResponse.ok,
    `/api/gourmet/entries returned ${gourmetResponse.status}`,
  );
  requireCors(gourmetResponse, "/api/gourmet/entries", webOrigin);
  const gourmet = await responseJson(gourmetResponse, gourmetPath);
  requireValue(
    Array.isArray(gourmet.entries),
    "/api/gourmet/entries did not return an entries array",
  );

  return { baseUrl, issuer, webOrigin };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const baseUrl = process.argv[2];
  if (!baseUrl) throw new Error("Usage: node scripts/smoke-api.mjs API_URL");
  const result = await runApiSmokeChecks(baseUrl);
  console.log(
    `API, OIDC, admin boundary, and Gourmet smoke checks passed: ${result.baseUrl}`,
  );
}
