import { serverEnv } from "@arlequins/env/server-env";

const SUPPORTED_SCOPES = [
  "gourmet:read",
  "gourmet:write",
  "openid",
  "profile",
  "email",
  "offline_access",
] as const;
const DEFAULT_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
] as const;
const SAFE_URI_PROTOCOLS = new Set(["https:", "http:"]);

export type BeatOidcClient = {
  clientId: string;
  postLogoutRedirectUris: string[];
  redirectUris: string[];
  resources: string[];
  scopes: string[];
};

export type BeatAuthorizationRequest = {
  client: BeatOidcClient;
  clientId: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  nonce: string;
  resource?: string;
  redirectUri: string;
  scope: string[];
  state: string;
};

export type BeatLogoutRequest = {
  client: BeatOidcClient;
  clientId: string;
  postLogoutRedirectUri?: string;
  state?: string;
};

export class BeatOidcConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BeatOidcConfigurationError";
  }
}

export class BeatOidcRequestError extends Error {
  constructor(
    readonly code: "invalid_request" | "invalid_scope" | "unauthorized_client",
    message = code,
  ) {
    super(message);
    this.name = "BeatOidcRequestError";
  }
}

function text(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function validClientId(value: string) {
  if (/^[A-Za-z0-9._~-]{1,100}$/.test(value)) return true;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "chatgpt.com" &&
      url.pathname.startsWith("/oauth/") &&
      url.search === "" &&
      url.hash === ""
    );
  } catch {
    return false;
  }
}

function oauthValue(value: unknown, maxLength = 2048) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxLength &&
    !Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127;
    })
  );
}

function validUri(value: string) {
  try {
    const parsed = new URL(value);
    return (
      SAFE_URI_PROTOCOLS.has(parsed.protocol) &&
      (parsed.protocol === "https:" || parsed.hostname === "localhost") &&
      parsed.hash === "" &&
      parsed.username === "" &&
      parsed.password === ""
    );
  } catch {
    return false;
  }
}

function uriList(value: unknown, field: string) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((uri) => typeof uri !== "string" || !validUri(uri as string))
  )
    throw new BeatOidcConfigurationError(
      `Invalid ${field} in client allowlist`,
    );
  return value as string[];
}

function optionalUriList(value: unknown, field: string) {
  if (value === undefined) return [];
  return uriList(value, field);
}

export function configuredBeatOidcClients(
  raw = serverEnv.BEAT_AUTH_CLIENTS_JSON,
) {
  if (!raw)
    throw new BeatOidcConfigurationError("BEAT_AUTH_CLIENTS_JSON is required");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BeatOidcConfigurationError(
      "BEAT_AUTH_CLIENTS_JSON must be valid JSON",
    );
  }
  if (!Array.isArray(parsed) || parsed.length === 0)
    throw new BeatOidcConfigurationError(
      "BEAT_AUTH_CLIENTS_JSON must be a non-empty array",
    );
  const clients = new Map<string, BeatOidcClient>();
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object")
      throw new BeatOidcConfigurationError("Invalid client allowlist entry");
    const row = entry as Record<string, unknown>;
    const clientId = text(row.client_id);
    if (!clientId || !validClientId(clientId))
      throw new BeatOidcConfigurationError(
        "Invalid client_id in client allowlist",
      );
    if (clients.has(clientId))
      throw new BeatOidcConfigurationError(`Duplicate client_id ${clientId}`);
    const scopes = row.scopes ?? [...DEFAULT_SCOPES];
    if (
      !Array.isArray(scopes) ||
      scopes.length === 0 ||
      scopes.some(
        (scope) =>
          typeof scope !== "string" ||
          !SUPPORTED_SCOPES.includes(
            scope as (typeof SUPPORTED_SCOPES)[number],
          ),
      )
    )
      throw new BeatOidcConfigurationError(`Invalid scopes for ${clientId}`);
    clients.set(clientId, {
      clientId,
      postLogoutRedirectUris: uriList(
        row.post_logout_redirect_uris,
        "post_logout_redirect_uris",
      ),
      redirectUris: uriList(row.redirect_uris, "redirect_uris"),
      resources: optionalUriList(row.resources, "resources"),
      scopes: scopes as string[],
    });
  }
  return clients;
}

function clientFor(clientId: unknown, raw?: string) {
  const id = text(clientId);
  if (!id) throw new BeatOidcRequestError("unauthorized_client");
  const client = configuredBeatOidcClients(raw).get(id);
  if (!client) throw new BeatOidcRequestError("unauthorized_client");
  return client;
}

function parseScope(value: unknown, client: BeatOidcClient) {
  const raw = text(value);
  if (!raw) throw new BeatOidcRequestError("invalid_scope");
  const scope = [...new Set(raw.split(/\s+/).filter(Boolean))];
  if (
    scope.length === 0 ||
    !scope.includes("openid") ||
    scope.some((item) => !client.scopes.includes(item))
  )
    throw new BeatOidcRequestError("invalid_scope");
  return scope;
}

function parseResource(value: unknown, client: BeatOidcClient) {
  const resource = text(value);
  if (resource === undefined) {
    if (client.resources.length > 0)
      throw new BeatOidcRequestError("invalid_request");
    return undefined;
  }
  if (!validUri(resource) || !client.resources.includes(resource))
    throw new BeatOidcRequestError("invalid_request");
  return resource;
}

function baseRequest(input: Record<string, unknown>, raw?: string) {
  const client = clientFor(input.client_id, raw);
  const redirectUri = text(input.redirect_uri);
  if (!redirectUri || !client.redirectUris.includes(redirectUri))
    throw new BeatOidcRequestError("invalid_request");
  const state = text(input.state);
  const nonce = text(input.nonce);
  if (
    typeof state !== "string" ||
    typeof nonce !== "string" ||
    !oauthValue(state) ||
    !oauthValue(nonce)
  )
    throw new BeatOidcRequestError("invalid_request");
  return { client, nonce, redirectUri, state };
}

export function validateAuthorizationRequest(
  input: Record<string, unknown>,
  raw?: string,
) {
  const base = baseRequest(input, raw);
  if (text(input.response_type) !== "code")
    throw new BeatOidcRequestError("invalid_request");
  const codeChallenge = text(input.code_challenge);
  if (
    !codeChallenge ||
    !/^[A-Za-z0-9_-]{43,128}$/.test(codeChallenge) ||
    text(input.code_challenge_method) !== "S256"
  )
    throw new BeatOidcRequestError("invalid_request");
  const resource = parseResource(input.resource, base.client);
  return {
    client: base.client,
    clientId: base.client.clientId,
    codeChallenge,
    codeChallengeMethod: "S256" as const,
    nonce: base.nonce,
    ...(resource ? { resource } : {}),
    redirectUri: base.redirectUri,
    scope: parseScope(input.scope, base.client),
    state: base.state,
  } satisfies BeatAuthorizationRequest;
}

export function validateLogoutRequest(
  input: Record<string, unknown>,
  raw?: string,
) {
  const client = clientFor(input.client_id, raw);
  const postLogoutRedirectUri = text(input.post_logout_redirect_uri);
  if (
    postLogoutRedirectUri &&
    !client.postLogoutRedirectUris.includes(postLogoutRedirectUri)
  )
    throw new BeatOidcRequestError("invalid_request");
  const state = text(input.state);
  if (state !== undefined && !oauthValue(state))
    throw new BeatOidcRequestError("invalid_request");
  return {
    client,
    clientId: client.clientId,
    ...(postLogoutRedirectUri ? { postLogoutRedirectUri } : {}),
    ...(state ? { state } : {}),
  } satisfies BeatLogoutRequest;
}

export function readStringRecord(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input).flatMap(([key, value]) => {
      const item = text(value);
      return item === undefined ? [] : [[key, item]];
    }),
  ) as Record<string, unknown>;
}

export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ] ?? character,
  );
}

export function authorizationForm(request: BeatAuthorizationRequest) {
  const hidden = Object.entries({
    client_id: request.clientId,
    redirect_uri: request.redirectUri,
    response_type: "code",
    scope: request.scope.join(" "),
    state: request.state,
    nonce: request.nonce,
    code_challenge: request.codeChallenge,
    code_challenge_method: "S256",
  })
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`,
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Beat authorization</title><meta http-equiv="Content-Security-Policy" content="default-src 'none';form-action 'self';base-uri 'none';frame-ancestors 'none';style-src 'unsafe-inline"></head><body><main><h1>Sign in to Beat</h1><form method="post" action="/auth/authorize" autocomplete="on">${hidden}<label>Email <input name="email" type="email" autocomplete="username" required></label><label>Password <input name="password" type="password" autocomplete="current-password" required></label><button type="submit">Continue</button></form></main></body></html>`;
}

export const supportedOidcScopes = [...SUPPORTED_SCOPES];
