"use client";

import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "~/env";

export const BeatAdminSessionKey = "beat-admin-session";
export const BeatAdminSessionEvent = "beat-admin-session-changed";
const BeatAdminOidcTransactionKey = "beat-admin-oidc-transaction";

export type BeatAdminSession = {
  accessExpiresAt: number;
  accessToken: string;
  idToken?: string;
  refreshExpiresAt: number;
  refreshToken: string;
};

type TokenResponse = {
  access_token: string;
  expires_in: number;
  id_token?: string;
  refresh_expires_in: number;
  refresh_token: string;
  token_type: "Bearer";
};

type OidcDiscovery = {
  authorization_endpoint: string;
  jwks_uri: string;
  issuer: string;
  token_endpoint: string;
};

type OidcTransaction = {
  codeVerifier: string;
  nonce: string;
  redirectUri: string;
  state: string;
};

function apiUrl() {
  return env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
}

function authority() {
  return env.NEXT_PUBLIC_OIDC_AUTHORITY.replace(/\/$/, "");
}

function adminPath(path: "admin" | "callback") {
  const current = new URL(window.location.href);
  const adminMarker = current.pathname.indexOf("/admin/");
  const basePath =
    adminMarker >= 0 ? current.pathname.slice(0, adminMarker) : "";
  current.pathname =
    `${basePath}/admin/${path === "admin" ? "" : `${path}/`}`.replace(
      /\/+/g,
      "/",
    );
  current.search = "";
  current.hash = "";
  return current;
}

function callbackUri() {
  return adminPath("callback").toString();
}

export function adminHomeUri() {
  return adminPath("admin").toString();
}

function randomValue(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function base64Url(bytes: ArrayBuffer) {
  const value = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(value)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function pkceChallenge(codeVerifier: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(codeVerifier),
  );
  return base64Url(digest);
}

async function oidcDiscovery() {
  const response = await fetch(
    `${authority()}/.well-known/openid-configuration`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error("Google 로그인 설정을 불러올 수 없습니다.");
  const discovery = (await response.json()) as Partial<OidcDiscovery>;
  if (
    typeof discovery.authorization_endpoint !== "string" ||
    typeof discovery.jwks_uri !== "string" ||
    typeof discovery.issuer !== "string" ||
    typeof discovery.token_endpoint !== "string" ||
    discovery.issuer.replace(/\/$/, "") !== authority()
  )
    throw new Error("Beat 로그인 발급자 설정을 확인할 수 없습니다.");
  return discovery as OidcDiscovery;
}

function writeOidcTransaction(transaction: OidcTransaction) {
  sessionStorage.setItem(
    BeatAdminOidcTransactionKey,
    JSON.stringify(transaction),
  );
}

function readOidcTransaction() {
  const raw = sessionStorage.getItem(BeatAdminOidcTransactionKey);
  sessionStorage.removeItem(BeatAdminOidcTransactionKey);
  if (!raw) throw new Error("Google 로그인 요청이 만료되었습니다.");
  try {
    const value = JSON.parse(raw) as Partial<OidcTransaction>;
    if (
      typeof value.codeVerifier !== "string" ||
      typeof value.nonce !== "string" ||
      typeof value.redirectUri !== "string" ||
      typeof value.state !== "string"
    )
      throw new Error("invalid transaction");
    return value as OidcTransaction;
  } catch {
    throw new Error("Google 로그인 요청이 유효하지 않습니다.");
  }
}

async function verifyIdToken(
  idToken: string,
  transaction: OidcTransaction,
  discovery: OidcDiscovery,
) {
  try {
    const { payload } = await jwtVerify(
      idToken,
      createRemoteJWKSet(new URL(discovery.jwks_uri)),
      {
        algorithms: ["ES256"],
        audience: env.NEXT_PUBLIC_OIDC_CLIENT_ID,
        issuer: authority(),
      },
    );
    if (payload.nonce !== transaction.nonce) throw new Error("nonce mismatch");
  } catch {
    throw new Error("Beat ID 토큰 검증에 실패했습니다.");
  }
}

export async function startBeatAdminGoogleLogin() {
  const discovery = await oidcDiscovery();
  const redirectUri = callbackUri();
  const codeVerifier = randomValue(48);
  const [codeChallenge, state, nonce] = await Promise.all([
    pkceChallenge(codeVerifier),
    Promise.resolve(randomValue()),
    Promise.resolve(randomValue()),
  ]);
  writeOidcTransaction({ codeVerifier, nonce, redirectUri, state });
  const authorization = new URL(discovery.authorization_endpoint);
  authorization.searchParams.set("client_id", env.NEXT_PUBLIC_OIDC_CLIENT_ID);
  authorization.searchParams.set("code_challenge", codeChallenge);
  authorization.searchParams.set("code_challenge_method", "S256");
  authorization.searchParams.set("nonce", nonce);
  authorization.searchParams.set("redirect_uri", redirectUri);
  authorization.searchParams.set("response_type", "code");
  authorization.searchParams.set("scope", env.NEXT_PUBLIC_OIDC_SCOPE);
  authorization.searchParams.set("state", state);
  window.location.assign(authorization.toString());
}

export async function completeBeatAdminGoogleLogin() {
  const params = new URL(window.location.href).searchParams;
  const error = params.get("error");
  const transaction = readOidcTransaction();
  if (error) throw new Error("Google 로그인이 취소되었습니다.");
  if (params.get("state") !== transaction.state)
    throw new Error("Google 로그인 상태 검증에 실패했습니다.");
  const code = params.get("code");
  if (!code) throw new Error("Google 로그인 코드를 받지 못했습니다.");
  const response = await fetch(`${authority()}/token`, {
    body: new URLSearchParams({
      client_id: env.NEXT_PUBLIC_OIDC_CLIENT_ID,
      code,
      code_verifier: transaction.codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: transaction.redirectUri,
    }),
    cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  if (!response.ok) throw new Error("Google 로그인 토큰을 교환할 수 없습니다.");
  const tokens = (await response.json()) as TokenResponse;
  if (!tokens.id_token) throw new Error("Beat ID 토큰을 받지 못했습니다.");
  const discovery = await oidcDiscovery();
  await verifyIdToken(tokens.id_token, transaction, discovery);
  const session = sessionFromTokens(tokens);
  writeBeatAdminSession(session);
  return session;
}

function sessionFromTokens(tokens: TokenResponse): BeatAdminSession {
  const now = Date.now();
  return {
    accessExpiresAt: now + tokens.expires_in * 1_000,
    accessToken: tokens.access_token,
    ...(tokens.id_token ? { idToken: tokens.id_token } : {}),
    refreshExpiresAt: now + tokens.refresh_expires_in * 1_000,
    refreshToken: tokens.refresh_token,
  };
}

export function readBeatAdminSession(): BeatAdminSession | undefined {
  try {
    const raw = localStorage.getItem(BeatAdminSessionKey);
    if (!raw) return undefined;
    const value = JSON.parse(raw) as Partial<BeatAdminSession>;
    if (
      typeof value.accessExpiresAt !== "number" ||
      typeof value.accessToken !== "string" ||
      typeof value.refreshExpiresAt !== "number" ||
      typeof value.refreshToken !== "string"
    )
      return undefined;
    return value as BeatAdminSession;
  } catch {
    return undefined;
  }
}

function writeBeatAdminSession(session: BeatAdminSession) {
  localStorage.setItem(BeatAdminSessionKey, JSON.stringify(session));
  window.dispatchEvent(new Event(BeatAdminSessionEvent));
}

export function clearBeatAdminSession() {
  localStorage.removeItem(BeatAdminSessionKey);
  window.dispatchEvent(new Event(BeatAdminSessionEvent));
}

export function hasPersistentBeatAdminSession() {
  const session = readBeatAdminSession();
  return Boolean(session && session.refreshExpiresAt > Date.now());
}

async function refreshBeatAdminSession(session: BeatAdminSession) {
  if (session.refreshExpiresAt <= Date.now()) {
    clearBeatAdminSession();
    throw new Error("로그인이 만료되었습니다.");
  }
  const response = await fetch(`${apiUrl()}/auth/token`, {
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: session.refreshToken,
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    clearBeatAdminSession();
    throw new Error("로그인을 갱신할 수 없습니다.");
  }
  const refreshed = sessionFromTokens((await response.json()) as TokenResponse);
  writeBeatAdminSession(refreshed);
  return refreshed;
}

export async function beatAdminAccessToken() {
  const session = readBeatAdminSession();
  if (!session) throw new Error("관리자 로그인이 필요합니다.");
  if (session.accessExpiresAt - Date.now() > 60_000) return session.accessToken;
  return (await refreshBeatAdminSession(session)).accessToken;
}

export async function logoutBeatAdmin() {
  const session = readBeatAdminSession();
  clearBeatAdminSession();
  if (!session) return;
  await fetch(`${apiUrl()}/auth/revoke`, {
    body: JSON.stringify({ token: session.refreshToken }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  }).catch(() => undefined);
}

export function beatAdminApiUrl() {
  return apiUrl();
}

export async function authorizedBeatAdminRequest(
  path: string,
  init?: RequestInit,
) {
  const token = await beatAdminAccessToken();
  return fetch(`${apiUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}
