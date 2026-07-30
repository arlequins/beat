import { scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@acme/env";
import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { importJWK, SignJWT } from "jose";

type AdminEvent = {
  at: string;
  email: string;
  passwordHash?: string;
  subject: string;
  type: "admin-created" | "admin-disabled" | "admin-password-changed";
};
type ActiveAdmin = { email: string; passwordHash: string; subject: string };

function required(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} is required for Beat authentication`);
  return value;
}
function config() {
  return {
    audience: required(serverEnv.BEAT_AUTH_AUDIENCE, "BEAT_AUTH_AUDIENCE"),
    bucket: required(
      serverEnv.BEAT_AUTH_EVENTS_BUCKET,
      "BEAT_AUTH_EVENTS_BUCKET",
    ),
    issuer: required(
      serverEnv.BEAT_AUTH_ISSUER_URL,
      "BEAT_AUTH_ISSUER_URL",
    ).replace(/\/$/, ""),
    keyId: required(
      serverEnv.BEAT_AUTH_SIGNING_KEY_ID,
      "BEAT_AUTH_SIGNING_KEY_ID",
    ),
    privateJwk: JSON.parse(
      required(
        serverEnv.BEAT_AUTH_SIGNING_PRIVATE_JWK,
        "BEAT_AUTH_SIGNING_PRIVATE_JWK",
      ),
    ) as JsonWebKey,
    prefix: serverEnv.BEAT_AUTH_EVENTS_PREFIX.replace(/\/$/, ""),
  };
}
async function text(body: unknown) {
  if (!body || typeof body !== "object" || !("transformToString" in body))
    throw new Error("Invalid S3 object body");
  return (
    body as { transformToString: () => Promise<string> }
  ).transformToString();
}
async function admins(client = new S3Client({})) {
  const c = config();
  const listed = await client.send(
    new ListObjectsV2Command({ Bucket: c.bucket, Prefix: `${c.prefix}/` }),
  );
  const events = await Promise.all(
    (listed.Contents ?? []).flatMap(({ Key }) =>
      Key
        ? [
            client
              .send(new GetObjectCommand({ Bucket: c.bucket, Key }))
              .then(async (r) => JSON.parse(await text(r.Body)) as AdminEvent),
          ]
        : [],
    ),
  );
  const current = new Map<string, ActiveAdmin | undefined>();
  for (const event of events.sort((a, b) => a.at.localeCompare(b.at))) {
    const key = event.email.toLowerCase();
    if (event.type === "admin-disabled") current.set(key, undefined);
    if (
      (event.type === "admin-created" ||
        event.type === "admin-password-changed") &&
      event.passwordHash
    )
      current.set(key, {
        email: key,
        passwordHash: event.passwordHash,
        subject: event.subject,
      });
  }
  return current;
}
async function verifyPassword(password: string, encoded: string) {
  const [, salt, expected] = encoded.split("$");
  if (!salt || !expected) return false;
  const actual = await new Promise<Buffer>((resolve, reject) =>
    scryptCallback(password, Buffer.from(salt, "base64url"), 64, (e, v) =>
      e ? reject(e) : resolve(v),
    ),
  );
  const target = Buffer.from(expected, "base64url");
  return actual.length === target.length && timingSafeEqual(actual, target);
}
export async function authenticateBeatAdmin(email: string, password: string) {
  const admin = (await admins()).get(email.trim().toLowerCase());
  return admin && (await verifyPassword(password, admin.passwordHash))
    ? admin
    : undefined;
}
export async function issueBeatAccessToken(admin: ActiveAdmin) {
  const c = config();
  return new SignJWT({ email: admin.email, role: "admin" })
    .setProtectedHeader({ alg: "ES256", kid: c.keyId, typ: "at+jwt" })
    .setAudience(c.audience)
    .setExpirationTime("10m")
    .setIssuedAt()
    .setIssuer(c.issuer)
    .setSubject(admin.subject)
    .sign(await importJWK(c.privateJwk, "ES256"));
}
export async function beatJwks() {
  const c = config();
  const key = { ...c.privateJwk };
  delete key.d;
  return { keys: [{ ...key, kid: c.keyId, use: "sig" }] };
}
