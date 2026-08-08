import { randomUUID } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const RequiredBeatRuntimeKeys = [
  "BEAT_AUTH_LOOKUP_SECRET",
  "BEAT_AUTH_ISSUER_URL",
  "BEAT_AUTH_AUDIENCE",
  "BEAT_AUTH_SIGNING_PRIVATE_JWK",
  "BEAT_AUTH_SIGNING_KEY_ID",
  "BEAT_GOURMET_ACTION_API_KEY",
  "GITHUB_APP_ID",
  "GITHUB_APP_INSTALLATION_ID",
  "GITHUB_APP_PRIVATE_KEY",
  "GITHUB_CONTENT_REPOSITORY",
];

export function validateBeatRuntimeSecret(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Beat runtime secret must be a JSON object");
  for (const key of RequiredBeatRuntimeKeys) {
    if (typeof input[key] !== "string" || input[key].length === 0)
      throw new Error(`Beat runtime secret is missing a non-empty ${key}`);
  }
  if (input.BEAT_AUTH_LOOKUP_SECRET.length < 32)
    throw new Error("BEAT_AUTH_LOOKUP_SECRET must be at least 32 characters");
  if (input.BEAT_GOURMET_ACTION_API_KEY.length < 32)
    throw new Error(
      "BEAT_GOURMET_ACTION_API_KEY must be at least 32 characters",
    );
  const issuer = new URL(input.BEAT_AUTH_ISSUER_URL);
  if (
    issuer.protocol !== "https:" ||
    !issuer.pathname.replace(/\/$/, "").endsWith("/auth")
  )
    throw new Error("BEAT_AUTH_ISSUER_URL must be an HTTPS /auth issuer");
  let signingJwk;
  try {
    signingJwk = JSON.parse(input.BEAT_AUTH_SIGNING_PRIVATE_JWK);
  } catch {
    throw new Error("BEAT_AUTH_SIGNING_PRIVATE_JWK must contain valid JSON");
  }
  if (
    signingJwk?.kty !== "EC" ||
    signingJwk?.crv !== "P-256" ||
    typeof signingJwk?.d !== "string" ||
    typeof signingJwk?.x !== "string" ||
    typeof signingJwk?.y !== "string"
  )
    throw new Error(
      "BEAT_AUTH_SIGNING_PRIVATE_JWK must be an EC P-256 private JWK",
    );
  if (!/^\d+$/.test(input.GITHUB_APP_ID))
    throw new Error("GITHUB_APP_ID must be numeric");
  if (!/^\d+$/.test(input.GITHUB_APP_INSTALLATION_ID))
    throw new Error("GITHUB_APP_INSTALLATION_ID must be numeric");
  if (
    !/-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(input.GITHUB_APP_PRIVATE_KEY)
  )
    throw new Error("GITHUB_APP_PRIVATE_KEY must be a PEM private key");
  if (!/^[^/\s]+\/[^/\s]+$/.test(input.GITHUB_CONTENT_REPOSITORY))
    throw new Error("GITHUB_CONTENT_REPOSITORY must use owner/repository");
  return Object.fromEntries(
    RequiredBeatRuntimeKeys.map((key) => [key, input[key]]),
  );
}

export function appendGitHubEnvironment(file, values) {
  for (const [key, value] of Object.entries(values)) {
    const delimiter = `BEAT_${randomUUID()}`;
    appendFileSync(file, `${key}<<${delimiter}\n${value}\n${delimiter}\n`, {
      mode: 0o600,
    });
  }
}

function escapeGitHubWorkflowCommand(value) {
  return value
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
}

/** Register every runtime value for log redaction before another Action step sees it. */
export function maskGitHubRuntimeSecret(values) {
  if (process.env.GITHUB_ACTIONS !== "true") return;
  for (const value of Object.values(values))
    console.log(`::add-mask::${escapeGitHubWorkflowCommand(value)}`);
}

export function validateRuntimeSecretFile(secretFile, githubEnvFile) {
  const values = validateBeatRuntimeSecret(
    JSON.parse(readFileSync(secretFile, "utf8")),
  );
  maskGitHubRuntimeSecret(values);
  if (githubEnvFile) appendGitHubEnvironment(githubEnvFile, values);
  return values;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const secretFile = process.env.BEAT_RUNTIME_SECRET_FILE;
  if (!secretFile) throw new Error("BEAT_RUNTIME_SECRET_FILE is required");
  validateRuntimeSecretFile(secretFile, process.env.BEAT_GITHUB_ENV_FILE);
  console.log("Beat runtime secret contract is valid.");
}
