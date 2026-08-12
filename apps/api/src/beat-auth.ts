import {
  createHmac,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";

import { serverEnv } from "@arlequins/env/server-env";
import {
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { importJWK, jwtVerify, SignJWT } from "jose";

const ACCESS_TOKEN_TTL_SECONDS = 10 * 60;
const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

export type ActiveAdmin = {
  adminKey: string;
  credentialVersion: number;
  email: string;
  passwordHash: string;
  role: "admin";
  subject: string;
};

type AdminState = ActiveAdmin & {
  revision: number;
  schemaVersion: 1;
  status: "active" | "disabled";
  updatedAt: string;
};

type RefreshSession = {
  adminKey: string;
  clientId: string;
  credentialVersion: number;
  expiresAt: string;
  generation: number;
  lastUsedAt: string;
  schemaVersion: 1;
  secretHash: string;
  sessionId: string;
  status: "active" | "revoked";
  subject: string;
};

type StoredJson = {
  etag: string;
  value: unknown;
};

type BeatAuthConfig = {
  audience: string;
  issuer: string;
  keyId: string;
  ledgerBucket: string;
  ledgerRetentionDays?: number;
  lookupSecret: string;
  privateJwk: JsonWebKey;
  refreshTokenTtlSeconds: number;
  stateBucket: string;
  statePrefix: string;
};

export type BeatTokenPair = {
  access_token: string;
  expires_in: number;
  refresh_expires_in: number;
  refresh_token: string;
  token_type: "Bearer";
};

export class BeatAuthError extends Error {
  constructor(
    readonly code: "conflict" | "invalid_credentials" | "invalid_refresh_token",
  ) {
    super(code);
    this.name = "BeatAuthError";
  }
}

function required(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} is required for Beat authentication`);
  return value;
}

function config(): BeatAuthConfig {
  return {
    audience: required(serverEnv.BEAT_AUTH_AUDIENCE, "BEAT_AUTH_AUDIENCE"),
    issuer: required(
      serverEnv.BEAT_AUTH_ISSUER_URL,
      "BEAT_AUTH_ISSUER_URL",
    ).replace(/\/$/, ""),
    keyId: required(
      serverEnv.BEAT_AUTH_SIGNING_KEY_ID,
      "BEAT_AUTH_SIGNING_KEY_ID",
    ),
    ledgerBucket: required(
      serverEnv.BEAT_AUTH_LEDGER_BUCKET,
      "BEAT_AUTH_LEDGER_BUCKET",
    ),
    ledgerRetentionDays: serverEnv.BEAT_AUTH_LEDGER_RETENTION_DAYS,
    lookupSecret: required(
      serverEnv.BEAT_AUTH_LOOKUP_SECRET,
      "BEAT_AUTH_LOOKUP_SECRET",
    ),
    privateJwk: JSON.parse(
      required(
        serverEnv.BEAT_AUTH_SIGNING_PRIVATE_JWK,
        "BEAT_AUTH_SIGNING_PRIVATE_JWK",
      ),
    ) as JsonWebKey,
    refreshTokenTtlSeconds:
      serverEnv.BEAT_AUTH_REFRESH_TOKEN_TTL_SECONDS ??
      DEFAULT_REFRESH_TOKEN_TTL_SECONDS,
    stateBucket: required(
      serverEnv.BEAT_AUTH_STATE_BUCKET,
      "BEAT_AUTH_STATE_BUCKET",
    ),
    statePrefix: serverEnv.BEAT_AUTH_STATE_PREFIX.replace(/^\/|\/$/g, ""),
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function emailLookup(email: string, authConfig: BeatAuthConfig) {
  return createHmac("sha256", authConfig.lookupSecret)
    .update(normalizeEmail(email))
    .digest("hex");
}

function adminKey(email: string, authConfig: BeatAuthConfig) {
  return `${authConfig.statePrefix}/admins/by-email/${emailLookup(email, authConfig)}.json`;
}

function sessionKey(sessionId: string, authConfig: BeatAuthConfig) {
  return `${authConfig.statePrefix}/oauth/sessions/${sessionId}.json`;
}

function secretHash(secret: string, authConfig: BeatAuthConfig) {
  return createHmac("sha256", authConfig.lookupSecret)
    .update(secret)
    .digest("base64url");
}

function parseStoredJson(body: string, key: string) {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error(`Invalid JSON in S3 object ${key}`);
  }
}

async function bodyText(body: unknown) {
  if (!body || typeof body !== "object" || !("transformToString" in body))
    throw new Error("Invalid S3 object body");
  return (
    body as { transformToString: () => Promise<string> }
  ).transformToString();
}

function isMissingObject(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    $metadata?: { httpStatusCode?: number };
    name?: string;
  };
  return (
    candidate.$metadata?.httpStatusCode === 404 ||
    candidate.name === "NoSuchKey" ||
    candidate.name === "NotFound"
  );
}

function isPreconditionFailed(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    $metadata?: { httpStatusCode?: number };
    name?: string;
  };
  return (
    candidate.$metadata?.httpStatusCode === 412 ||
    candidate.name === "PreconditionFailed"
  );
}

async function getJson(
  client: S3Client,
  bucket: string,
  key: string,
): Promise<StoredJson | undefined> {
  try {
    const response = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    if (!response.ETag)
      throw new Error(`S3 object ${key} did not include an ETag`);
    return {
      etag: response.ETag,
      value: parseStoredJson(await bodyText(response.Body), key),
    };
  } catch (error) {
    if (isMissingObject(error)) return undefined;
    throw error;
  }
}

async function putJson(
  client: S3Client,
  input: {
    bucket: string;
    ifMatch?: string;
    ifNoneMatch?: "*";
    key: string;
    lockUntil?: Date;
    value: unknown;
  },
) {
  await client.send(
    new PutObjectCommand({
      Body: JSON.stringify(input.value),
      Bucket: input.bucket,
      ContentType: "application/json",
      IfMatch: input.ifMatch,
      IfNoneMatch: input.ifNoneMatch,
      Key: input.key,
      ...(input.lockUntil
        ? {
            ObjectLockMode: "COMPLIANCE" as const,
            ObjectLockRetainUntilDate: input.lockUntil,
          }
        : {}),
    }),
  );
}

function isAdminState(value: unknown): value is AdminState {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    row.schemaVersion === 1 &&
    typeof row.revision === "number" &&
    typeof row.adminKey === "string" &&
    typeof row.subject === "string" &&
    typeof row.email === "string" &&
    typeof row.passwordHash === "string" &&
    (row.status === "active" || row.status === "disabled") &&
    row.role === "admin" &&
    typeof row.credentialVersion === "number" &&
    typeof row.updatedAt === "string"
  );
}

function isRefreshSession(value: unknown): value is RefreshSession {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    row.schemaVersion === 1 &&
    typeof row.adminKey === "string" &&
    typeof row.clientId === "string" &&
    typeof row.credentialVersion === "number" &&
    typeof row.expiresAt === "string" &&
    typeof row.generation === "number" &&
    typeof row.lastUsedAt === "string" &&
    typeof row.secretHash === "string" &&
    typeof row.sessionId === "string" &&
    (row.status === "active" || row.status === "revoked") &&
    typeof row.subject === "string"
  );
}

async function readAdminByKey(
  key: string,
  client: S3Client,
  authConfig: BeatAuthConfig,
) {
  const stored = await getJson(client, authConfig.stateBucket, key);
  if (!stored) return undefined;
  if (!isAdminState(stored.value))
    throw new Error(`Invalid administrator state in ${key}`);
  return { ...stored, value: stored.value };
}

async function appendLedgerEvent(
  type: string,
  details: Record<string, unknown>,
  client: S3Client,
  authConfig: BeatAuthConfig,
  now = new Date(),
) {
  const eventId = randomUUID();
  const timestamp = now.toISOString();
  const pathDate = timestamp.slice(0, 10).replaceAll("-", "/");
  const lockUntil = authConfig.ledgerRetentionDays
    ? new Date(
        now.getTime() + authConfig.ledgerRetentionDays * 24 * 60 * 60 * 1_000,
      )
    : undefined;
  await putJson(client, {
    bucket: authConfig.ledgerBucket,
    ifNoneMatch: "*",
    key: `v1/events/auth/${pathDate}/${timestamp}-${eventId}.json`,
    lockUntil,
    value: {
      details,
      eventId,
      occurredAt: timestamp,
      schemaVersion: 1,
      type,
    },
  });
}

async function derivePasswordHash(password: string) {
  const salt = randomBytes(16);
  const value = await new Promise<Buffer>((resolve, reject) =>
    scryptCallback(password, salt, 64, (error, result) =>
      error ? reject(error) : resolve(result),
    ),
  );
  return `scrypt$v=1$${salt.toString("base64url")}$${value.toString("base64url")}`;
}

async function verifyPassword(password: string, encoded: string) {
  const parts = encoded.split("$");
  const [salt, expected] =
    parts.length === 4 && parts[1] === "v=1"
      ? [parts[2], parts[3]]
      : [parts[1], parts[2]];
  if (!salt || !expected) return false;
  const actual = await new Promise<Buffer>((resolve, reject) =>
    scryptCallback(
      password,
      Buffer.from(salt, "base64url"),
      64,
      (error, value) => (error ? reject(error) : resolve(value)),
    ),
  );
  const target = Buffer.from(expected, "base64url");
  return actual.length === target.length && timingSafeEqual(actual, target);
}

export async function createBeatAdmin(
  email: string,
  password: string,
  client = new S3Client({}),
) {
  const authConfig = config();
  const normalizedEmail = normalizeEmail(email);
  const key = adminKey(normalizedEmail, authConfig);
  const now = new Date();
  const state: AdminState = {
    adminKey: key,
    credentialVersion: 1,
    email: normalizedEmail,
    passwordHash: await derivePasswordHash(password),
    revision: 1,
    role: "admin",
    schemaVersion: 1,
    status: "active",
    subject: randomUUID(),
    updatedAt: now.toISOString(),
  };
  try {
    await putJson(client, {
      bucket: authConfig.stateBucket,
      ifNoneMatch: "*",
      key,
      value: state,
    });
  } catch (error) {
    if (isPreconditionFailed(error)) throw new BeatAuthError("conflict");
    throw error;
  }
  await appendLedgerEvent(
    "admin-created",
    {
      adminKey: key,
      email: normalizedEmail,
      revision: state.revision,
      subject: state.subject,
    },
    client,
    authConfig,
    now,
  );
  return { email: normalizedEmail, subject: state.subject };
}

async function updateBeatAdmin(
  email: string,
  update: (
    current: AdminState,
    now: Date,
  ) => Promise<{
    eventType: "admin-disabled" | "admin-password-changed";
    state: AdminState;
  }>,
  client: S3Client,
) {
  const authConfig = config();
  const key = adminKey(email, authConfig);
  const stored = await readAdminByKey(key, client, authConfig);
  if (!stored) throw new BeatAuthError("invalid_credentials");
  const now = new Date();
  const mutation = await update(stored.value, now);
  try {
    await putJson(client, {
      bucket: authConfig.stateBucket,
      ifMatch: stored.etag,
      key,
      value: mutation.state,
    });
  } catch (error) {
    if (isPreconditionFailed(error)) throw new BeatAuthError("conflict");
    throw error;
  }
  await appendLedgerEvent(
    mutation.eventType,
    {
      adminKey: key,
      email: mutation.state.email,
      revision: mutation.state.revision,
      subject: mutation.state.subject,
    },
    client,
    authConfig,
    now,
  );
  return {
    email: mutation.state.email,
    revision: mutation.state.revision,
    subject: mutation.state.subject,
  };
}

export async function changeBeatAdminPassword(
  email: string,
  password: string,
  client = new S3Client({}),
) {
  return updateBeatAdmin(
    email,
    async (current, now) => ({
      eventType: "admin-password-changed",
      state: {
        ...current,
        credentialVersion: current.credentialVersion + 1,
        passwordHash: await derivePasswordHash(password),
        revision: current.revision + 1,
        updatedAt: now.toISOString(),
      },
    }),
    client,
  );
}

export async function disableBeatAdmin(
  email: string,
  client = new S3Client({}),
) {
  return updateBeatAdmin(
    email,
    async (current, now) => ({
      eventType: "admin-disabled",
      state: {
        ...current,
        credentialVersion: current.credentialVersion + 1,
        revision: current.revision + 1,
        status: "disabled",
        updatedAt: now.toISOString(),
      },
    }),
    client,
  );
}

export async function authenticateBeatAdmin(
  email: string,
  password: string,
  client = new S3Client({}),
): Promise<ActiveAdmin | undefined> {
  const authConfig = config();
  const key = adminKey(email, authConfig);
  const stored = await readAdminByKey(key, client, authConfig);
  if (
    stored?.value.status !== "active" ||
    !(await verifyPassword(password, stored.value.passwordHash))
  )
    return undefined;
  return stored.value;
}

export async function issueBeatAccessToken(admin: ActiveAdmin) {
  const authConfig = config();
  return new SignJWT({
    client_id: authConfig.audience,
    credential_version: admin.credentialVersion,
    email: admin.email,
    jti: randomUUID(),
    role: admin.role,
  })
    .setProtectedHeader({
      alg: "ES256",
      kid: authConfig.keyId,
      typ: "at+jwt",
    })
    .setAudience(authConfig.audience)
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .setIssuedAt()
    .setIssuer(authConfig.issuer)
    .setSubject(admin.subject)
    .sign(await importJWK(authConfig.privateJwk, "ES256"));
}

function newRefreshToken(sessionId: string, generation: number) {
  const secret = randomBytes(32).toString("base64url");
  return {
    secret,
    token: `${sessionId}.${generation}.${secret}`,
  };
}

function parseRefreshToken(token: string) {
  const [sessionId, rawGeneration, secret, ...extra] = token.split(".");
  const generation = Number(rawGeneration);
  if (
    !sessionId ||
    !secret ||
    extra.length > 0 ||
    !Number.isSafeInteger(generation) ||
    generation < 1
  )
    throw new BeatAuthError("invalid_refresh_token");
  return { generation, secret, sessionId };
}

async function revokeSessionAfterReuse(
  sessionId: string,
  client: S3Client,
  authConfig: BeatAuthConfig,
) {
  const key = sessionKey(sessionId, authConfig);
  const latest = await getJson(client, authConfig.stateBucket, key);
  if (!latest || !isRefreshSession(latest.value)) return;
  try {
    await putJson(client, {
      bucket: authConfig.stateBucket,
      ifMatch: latest.etag,
      key,
      value: {
        ...latest.value,
        status: "revoked",
      } satisfies RefreshSession,
    });
  } catch (error) {
    if (!isPreconditionFailed(error)) throw error;
  }
}

export async function issueBeatTokenPair(
  admin: ActiveAdmin,
  clientId = config().audience,
  client = new S3Client({}),
): Promise<BeatTokenPair> {
  const authConfig = config();
  const sessionId = randomUUID();
  const refresh = newRefreshToken(sessionId, 1);
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + authConfig.refreshTokenTtlSeconds * 1_000,
  );
  const session: RefreshSession = {
    adminKey: admin.adminKey,
    clientId,
    credentialVersion: admin.credentialVersion,
    expiresAt: expiresAt.toISOString(),
    generation: 1,
    lastUsedAt: now.toISOString(),
    schemaVersion: 1,
    secretHash: secretHash(refresh.secret, authConfig),
    sessionId,
    status: "active",
    subject: admin.subject,
  };
  await putJson(client, {
    bucket: authConfig.stateBucket,
    ifNoneMatch: "*",
    key: sessionKey(sessionId, authConfig),
    value: session,
  });
  await appendLedgerEvent(
    "refresh-session-created",
    { clientId, sessionId, subject: admin.subject },
    client,
    authConfig,
    now,
  );
  return {
    access_token: await issueBeatAccessToken(admin),
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_expires_in: authConfig.refreshTokenTtlSeconds,
    refresh_token: refresh.token,
    token_type: "Bearer",
  };
}

export async function refreshBeatTokenPair(
  token: string,
  client = new S3Client({}),
): Promise<BeatTokenPair> {
  const authConfig = config();
  const presented = parseRefreshToken(token);
  const key = sessionKey(presented.sessionId, authConfig);
  const stored = await getJson(client, authConfig.stateBucket, key);
  if (!stored || !isRefreshSession(stored.value))
    throw new BeatAuthError("invalid_refresh_token");
  const session = stored.value;
  const now = new Date();
  const expired = Date.parse(session.expiresAt) <= now.getTime();
  if (
    session.status !== "active" ||
    expired ||
    presented.generation !== session.generation ||
    secretHash(presented.secret, authConfig) !== session.secretHash
  ) {
    if (presented.generation < session.generation) {
      await revokeSessionAfterReuse(presented.sessionId, client, authConfig);
      await appendLedgerEvent(
        "refresh-token-reuse-detected",
        { sessionId: session.sessionId, subject: session.subject },
        client,
        authConfig,
        now,
      );
    }
    throw new BeatAuthError("invalid_refresh_token");
  }
  const admin = await readAdminByKey(session.adminKey, client, authConfig);
  if (
    admin?.value.status !== "active" ||
    admin.value.subject !== session.subject ||
    admin.value.credentialVersion !== session.credentialVersion
  )
    throw new BeatAuthError("invalid_refresh_token");

  const refresh = newRefreshToken(session.sessionId, session.generation + 1);
  const rotated: RefreshSession = {
    ...session,
    generation: session.generation + 1,
    lastUsedAt: now.toISOString(),
    secretHash: secretHash(refresh.secret, authConfig),
  };
  try {
    await putJson(client, {
      bucket: authConfig.stateBucket,
      ifMatch: stored.etag,
      key,
      value: rotated,
    });
  } catch (error) {
    if (!isPreconditionFailed(error)) throw error;
    await revokeSessionAfterReuse(session.sessionId, client, authConfig);
    await appendLedgerEvent(
      "refresh-token-reuse-detected",
      { sessionId: session.sessionId, subject: session.subject },
      client,
      authConfig,
      now,
    );
    throw new BeatAuthError("invalid_refresh_token");
  }
  await appendLedgerEvent(
    "refresh-token-rotated",
    {
      generation: rotated.generation,
      sessionId: session.sessionId,
      subject: session.subject,
    },
    client,
    authConfig,
    now,
  );
  return {
    access_token: await issueBeatAccessToken(admin.value),
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_expires_in: Math.max(
      0,
      Math.floor((Date.parse(session.expiresAt) - now.getTime()) / 1_000),
    ),
    refresh_token: refresh.token,
    token_type: "Bearer",
  };
}

export async function revokeBeatRefreshToken(
  token: string,
  client = new S3Client({}),
) {
  const authConfig = config();
  const presented = parseRefreshToken(token);
  const key = sessionKey(presented.sessionId, authConfig);
  const stored = await getJson(client, authConfig.stateBucket, key);
  if (!stored || !isRefreshSession(stored.value)) return;
  if (
    stored.value.generation !== presented.generation ||
    secretHash(presented.secret, authConfig) !== stored.value.secretHash
  )
    return;
  try {
    await putJson(client, {
      bucket: authConfig.stateBucket,
      ifMatch: stored.etag,
      key,
      value: {
        ...stored.value,
        status: "revoked",
      } satisfies RefreshSession,
    });
  } catch (error) {
    if (!isPreconditionFailed(error)) throw error;
  }
  await appendLedgerEvent(
    "refresh-session-revoked",
    {
      sessionId: stored.value.sessionId,
      subject: stored.value.subject,
    },
    client,
    authConfig,
  );
}

export async function checkBeatStorageReadiness(client = new S3Client({})) {
  const authConfig = config();
  await Promise.all([
    client.send(new HeadBucketCommand({ Bucket: authConfig.stateBucket })),
    client.send(new HeadBucketCommand({ Bucket: authConfig.ledgerBucket })),
  ]);
}

export async function beatJwks() {
  const authConfig = config();
  const key = { ...authConfig.privateJwk };
  delete key.d;
  return {
    keys: [
      {
        ...key,
        alg: "ES256",
        kid: authConfig.keyId,
        use: "sig",
      },
    ],
  };
}

export async function verifyBeatAccessToken(token: string) {
  const authConfig = config();
  const publicJwk = { ...authConfig.privateJwk };
  delete publicJwk.d;
  const { payload } = await jwtVerify(
    token,
    await importJWK(publicJwk, "ES256"),
    {
      algorithms: ["ES256"],
      audience: authConfig.audience,
      issuer: authConfig.issuer,
    },
  );
  if (
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string" ||
    payload.role !== "admin"
  )
    throw new BeatAuthError("invalid_credentials");
  return {
    email: payload.email,
    subject: payload.sub,
  };
}
