import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { serverEnv } from "@arlequins/env/server-env";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { BeatAuthorizationRequest } from "./beat-oidc";

const GOOGLE_AUTHORIZATION_ENDPOINT =
  "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const STATE_TTL_SECONDS = 10 * 60;
export const GOOGLE_ALLOWED_EMAIL = "tiret.rouge@gmail.com";

type GoogleStateRequest = Pick<
  BeatAuthorizationRequest,
  | "clientId"
  | "codeChallenge"
  | "codeChallengeMethod"
  | "nonce"
  | "resource"
  | "redirectUri"
  | "scope"
  | "state"
>;

type GoogleAuthorizationState = {
  exp: number;
  iat: number;
  nonce: string;
  request: GoogleStateRequest;
  version: 1;
};

export type GoogleIdentity = {
  email: string;
  subject: string;
};

function required(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} is required for Google SSO`);
  return value;
}

function issuer() {
  return required(
    serverEnv.BEAT_AUTH_ISSUER_URL,
    "BEAT_AUTH_ISSUER_URL",
  ).replace(/\/$/, "");
}

function googleConfig() {
  return {
    clientId: required(
      serverEnv.BEAT_AUTH_GOOGLE_CLIENT_ID,
      "BEAT_AUTH_GOOGLE_CLIENT_ID",
    ),
    clientSecret: required(
      serverEnv.BEAT_AUTH_GOOGLE_CLIENT_SECRET,
      "BEAT_AUTH_GOOGLE_CLIENT_SECRET",
    ),
    redirectUri:
      serverEnv.BEAT_AUTH_GOOGLE_REDIRECT_URI ?? `${issuer()}/google/callback`,
    lookupSecret: required(
      serverEnv.BEAT_AUTH_LOOKUP_SECRET,
      "BEAT_AUTH_LOOKUP_SECRET",
    ),
  };
}

export function isGoogleSsoConfigured() {
  return Boolean(
    serverEnv.BEAT_AUTH_GOOGLE_CLIENT_ID &&
      serverEnv.BEAT_AUTH_GOOGLE_CLIENT_SECRET,
  );
}

function encode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function statePayload(
  request: GoogleStateRequest,
  nonce: string,
  now = Date.now(),
) {
  const state: GoogleAuthorizationState = {
    exp: Math.floor(now / 1_000) + STATE_TTL_SECONDS,
    iat: Math.floor(now / 1_000),
    nonce,
    request,
    version: 1,
  };
  const encoded = encode(JSON.stringify(state));
  const secret = required(
    serverEnv.BEAT_AUTH_LOOKUP_SECRET,
    "BEAT_AUTH_LOOKUP_SECRET",
  );
  return `${encoded}.${sign(encoded, secret)}`;
}

export function createGoogleAuthorizationUrl(request: GoogleStateRequest) {
  const config = googleConfig();
  const nonce = randomUUID();
  const state = statePayload(request, nonce);
  const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  return url.toString();
}

export function verifyGoogleAuthorizationState(raw: string) {
  const [encoded, receivedSignature, ...extra] = raw.split(".");
  if (!encoded || !receivedSignature || extra.length > 0)
    throw new Error("Invalid Google authorization state");
  const secret = required(
    serverEnv.BEAT_AUTH_LOOKUP_SECRET,
    "BEAT_AUTH_LOOKUP_SECRET",
  );
  const expectedSignature = sign(encoded, secret);
  const expected = Buffer.from(expectedSignature);
  const received = Buffer.from(receivedSignature);
  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  )
    throw new Error("Invalid Google authorization state");
  let state: unknown;
  try {
    state = JSON.parse(decode(encoded));
  } catch {
    throw new Error("Invalid Google authorization state");
  }
  if (!state || typeof state !== "object")
    throw new Error("Invalid Google authorization state");
  const candidate = state as Partial<GoogleAuthorizationState>;
  if (
    candidate.version !== 1 ||
    typeof candidate.iat !== "number" ||
    typeof candidate.exp !== "number" ||
    typeof candidate.nonce !== "string" ||
    !candidate.request ||
    candidate.exp < Math.floor(Date.now() / 1_000) ||
    candidate.iat > Math.floor(Date.now() / 1_000) + 30
  )
    throw new Error("Expired Google authorization state");
  return candidate as GoogleAuthorizationState;
}

async function googleToken(code: string) {
  const config = googleConfig();
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  if (!response.ok)
    throw new Error("Google authorization code exchange failed");
  const body = (await response.json()) as { id_token?: unknown };
  if (typeof body.id_token !== "string")
    throw new Error("Google token response did not include an ID token");
  return body.id_token;
}

export async function exchangeGoogleAuthorizationCode(
  code: string,
  nonce: string,
): Promise<GoogleIdentity> {
  const config = googleConfig();
  const idToken = await googleToken(code);
  const { payload } = await jwtVerify(
    idToken,
    createRemoteJWKSet(new URL(GOOGLE_JWKS_URI)),
    {
      algorithms: ["RS256"],
      audience: config.clientId,
      issuer: GOOGLE_ISSUERS,
    },
  );
  if (
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string" ||
    payload.email_verified !== true ||
    payload.nonce !== nonce
  )
    throw new Error("Google identity verification failed");
  const email = payload.email.trim().toLowerCase();
  if (email !== GOOGLE_ALLOWED_EMAIL)
    throw new Error("Google account is not allowed for this Beat");
  return { email, subject: payload.sub };
}

export function googleRedirectUri() {
  return googleConfig().redirectUri;
}
