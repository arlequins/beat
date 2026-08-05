"use client";

import { env } from "~/env";

export const BeatAdminSessionKey = "beat-admin-session";
export const BeatAdminSessionEvent = "beat-admin-session-changed";

export type BeatAdminSession = {
  accessExpiresAt: number;
  accessToken: string;
  refreshExpiresAt: number;
  refreshToken: string;
};

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_expires_in: number;
  refresh_token: string;
  token_type: "Bearer";
};

function apiUrl() {
  return env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
}

function sessionFromTokens(tokens: TokenResponse): BeatAdminSession {
  const now = Date.now();
  return {
    accessExpiresAt: now + tokens.expires_in * 1_000,
    accessToken: tokens.access_token,
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

async function parseTokenResponse(response: Response) {
  if (!response.ok) throw new Error("로그인 정보를 확인할 수 없습니다.");
  return (await response.json()) as TokenResponse;
}

export async function loginBeatAdmin(email: string, password: string) {
  const response = await fetch(`${apiUrl()}/auth/login`, {
    body: JSON.stringify({ email, password }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const session = sessionFromTokens(await parseTokenResponse(response));
  writeBeatAdminSession(session);
  return session;
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
