import { createHmac } from "node:crypto";

import { serverEnv } from "@acme/env/server-env";
import type { RateLimitPort, RateLimitRequest } from "@acme/service";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

type RateLimitState = {
  count: number;
  resetAt: string;
  schemaVersion: 1;
};

function required(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} is required for S3 rate limiting`);
  return value;
}

function preconditionFailed(error: unknown) {
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

function missing(error: unknown) {
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

async function bodyText(body: unknown) {
  if (!body || typeof body !== "object" || !("transformToString" in body))
    throw new Error("Invalid S3 rate-limit object body");
  return (
    body as { transformToString: () => Promise<string> }
  ).transformToString();
}

function stateKey(
  input: RateLimitRequest,
  lookupSecret: string,
  prefix: string,
) {
  const windowStart =
    Math.floor(input.now.getTime() / input.windowMs) * input.windowMs;
  const identity = createHmac("sha256", lookupSecret)
    .update(input.key)
    .digest("hex");
  return {
    key: `${prefix}/rate-limit/login-ip/${identity}/${new Date(windowStart).toISOString()}.json`,
    resetAt: new Date(windowStart + input.windowMs),
  };
}

export function createS3RateLimitAdapter(options?: {
  bucket?: string;
  client?: S3Client;
  lookupSecret?: string;
  prefix?: string;
  retries?: number;
}): RateLimitPort {
  const bucket =
    options?.bucket ??
    required(serverEnv.BEAT_AUTH_STATE_BUCKET, "BEAT_AUTH_STATE_BUCKET");
  const lookupSecret =
    options?.lookupSecret ??
    required(serverEnv.BEAT_AUTH_LOOKUP_SECRET, "BEAT_AUTH_LOOKUP_SECRET");
  const prefix = (
    options?.prefix ??
    serverEnv.BEAT_AUTH_STATE_PREFIX ??
    "v1"
  ).replace(/^\/|\/$/g, "");
  const client = options?.client ?? new S3Client({});
  const retries = options?.retries ?? 4;

  return {
    async consume(input) {
      const window = stateKey(input, lookupSecret, prefix);
      for (let attempt = 0; attempt < retries; attempt += 1) {
        let current: { etag: string; state: RateLimitState } | undefined;
        try {
          const response = await client.send(
            new GetObjectCommand({ Bucket: bucket, Key: window.key }),
          );
          if (!response.ETag)
            throw new Error("S3 rate-limit object did not include an ETag");
          const parsed = JSON.parse(await bodyText(response.Body)) as unknown;
          if (
            !parsed ||
            typeof parsed !== "object" ||
            typeof (parsed as RateLimitState).count !== "number" ||
            (parsed as RateLimitState).schemaVersion !== 1
          )
            throw new Error("Invalid S3 rate-limit state");
          current = {
            etag: response.ETag,
            state: parsed as RateLimitState,
          };
        } catch (error) {
          if (!missing(error)) throw error;
        }

        const count = (current?.state.count ?? 0) + 1;
        const next: RateLimitState = {
          count,
          resetAt: window.resetAt.toISOString(),
          schemaVersion: 1,
        };
        try {
          await client.send(
            new PutObjectCommand({
              Body: JSON.stringify(next),
              Bucket: bucket,
              ContentType: "application/json",
              IfMatch: current?.etag,
              IfNoneMatch: current ? undefined : "*",
              Key: window.key,
            }),
          );
          return {
            allowed: count <= input.limit,
            limit: input.limit,
            remaining: Math.max(0, input.limit - count),
            resetAt: window.resetAt,
          };
        } catch (error) {
          if (!preconditionFailed(error)) throw error;
        }
      }
      throw new Error("S3 rate-limit state remained contended");
    },
  };
}
