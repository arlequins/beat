import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

const requiredKeys = [
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
] as const;

type RuntimeSecretKey = (typeof requiredKeys)[number];
type RuntimeSecret = Record<RuntimeSecretKey, string>;

let loaded: Promise<void> | undefined;

function hasRuntimeSecret(): boolean {
  return requiredKeys.every((key) => Boolean(process.env[key]));
}

export function parseBeatRuntimeSecret(value: string): RuntimeSecret {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Beat runtime secret must be valid JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("Beat runtime secret must be a JSON object");

  const record = parsed as Record<string, unknown>;
  const secret = {} as RuntimeSecret;
  for (const key of requiredKeys) {
    if (typeof record[key] !== "string" || record[key].length === 0)
      throw new Error(`Beat runtime secret is missing ${key}`);
    secret[key] = record[key];
  }
  return secret;
}

/**
 * Hydrates only the running Lambda process. The secret ARN, not its value, is
 * declared by SST so Pulumi state and Lambda configuration stay secret-free.
 */
export function loadBeatRuntimeSecret(): Promise<void> {
  if (hasRuntimeSecret()) return Promise.resolve();
  if (loaded) return loaded;

  const secretArn = process.env.BEAT_RUNTIME_SECRET_ARN;
  if (!secretArn)
    return Promise.reject(
      new Error(
        "BEAT_RUNTIME_SECRET_ARN is required when Beat runtime values are absent",
      ),
    );

  loaded = (async () => {
    const response = await new SecretsManagerClient({}).send(
      new GetSecretValueCommand({ SecretId: secretArn }),
    );
    if (!response.SecretString)
      throw new Error("Beat runtime secret does not contain SecretString");
    const secret = parseBeatRuntimeSecret(response.SecretString);
    for (const [key, value] of Object.entries(secret)) process.env[key] = value;
  })();
  return loaded;
}
