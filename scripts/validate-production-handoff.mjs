#!/usr/bin/env node

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Validate the public Beat/Agent production contract without contacting AWS.
 * The values checked here are identifiers and URLs; runtime secrets are never
 * accepted by this script.
 */

function requireHttpsUrl(value, name) {
  if (!value) throw new Error(`${name} is required`);
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error(`${name} must use HTTPS`);
  }
  return url;
}

function appBaseUrl(value) {
  const url = requireHttpsUrl(value, "NEXT_PUBLIC_BEAT_APP_URL");
  return new URL(
    url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`,
    url,
  );
}

function exactCallback(base, path) {
  return new URL(path, base).href;
}

function parseClientRegistration(value) {
  if (!value) throw new Error("BEAT_AUTH_CLIENTS_JSON is required");
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("BEAT_AUTH_CLIENTS_JSON must be valid JSON");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("BEAT_AUTH_CLIENTS_JSON must contain a client array");
  }
  const client = parsed.find(
    (candidate) => candidate?.client_id === "beat-agent-web",
  );
  if (!client)
    throw new Error("BEAT_AUTH_CLIENTS_JSON must register beat-agent-web");
  return client;
}

function exactOrigins(value) {
  const origins = new Set(
    (value ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
  if (origins.has("*")) throw new Error("API_CORS_ORIGINS must not contain *");
  return origins;
}

export function validateProductionHandoff(env = process.env) {
  const base = appBaseUrl(env.NEXT_PUBLIC_BEAT_APP_URL);
  const client = parseClientRegistration(env.BEAT_AUTH_CLIENTS_JSON);
  const expectedRedirect = exactCallback(base, "auth/callback/");
  const expectedLogout = exactCallback(base, "auth/logout-callback/");

  if (
    client.redirect_uris?.length !== 1 ||
    client.redirect_uris[0] !== expectedRedirect
  ) {
    throw new Error(
      `beat-agent-web redirect URI must be exactly ${expectedRedirect}`,
    );
  }
  if (
    client.post_logout_redirect_uris?.length !== 1 ||
    client.post_logout_redirect_uris[0] !== expectedLogout
  ) {
    throw new Error(
      `beat-agent-web logout URI must be exactly ${expectedLogout}`,
    );
  }
  const scopes = new Set(client.scopes ?? []);
  for (const scope of ["openid", "profile", "email", "offline_access"]) {
    if (!scopes.has(scope))
      throw new Error(`beat-agent-web must allow ${scope}`);
  }

  const corsOrigins = exactOrigins(env.API_CORS_ORIGINS);
  if (!corsOrigins.has("https://arlequins.github.io")) {
    throw new Error("API_CORS_ORIGINS must allow the GitHub Pages origin");
  }
  if (!corsOrigins.has(base.origin)) {
    throw new Error(
      `API_CORS_ORIGINS must allow the Beat Agent origin ${base.origin}`,
    );
  }

  return {
    agentOrigin: base.origin,
    callback: expectedRedirect,
    logoutCallback: expectedLogout,
    clientId: client.client_id,
  };
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  const result = validateProductionHandoff();
  console.log(JSON.stringify({ productionHandoff: "valid", ...result }));
}
