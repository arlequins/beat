import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  RequiredBeatRuntimeKeys,
  validateBeatRuntimeSecret,
} from "./validate-beat-runtime-secret.mjs";

const valid = {
  BEAT_AUTH_AUDIENCE: "beat-agent",
  BEAT_AUTH_GOOGLE_CLIENT_ID: "client-id.apps.googleusercontent.com",
  BEAT_AUTH_GOOGLE_CLIENT_SECRET: "google-client-secret",
  BEAT_AUTH_GOOGLE_REDIRECT_URI: "https://api.example.com/auth/google/callback",
  BEAT_AUTH_ISSUER_URL: "https://api.example.com/auth",
  BEAT_AUTH_LOOKUP_SECRET: "lookup-secret-at-least-32-characters",
  BEAT_AUTH_SIGNING_KEY_ID: "beat-auth-2026-01",
  BEAT_AUTH_SIGNING_PRIVATE_JWK: JSON.stringify({
    crv: "P-256",
    d: "private",
    kty: "EC",
    x: "public-x",
    y: "public-y",
  }),
  BEAT_GOURMET_ACTION_API_KEY: "gourmet-action-key-at-least-32-chars",
  GITHUB_APP_ID: "123456",
  GITHUB_APP_INSTALLATION_ID: "987654",
  GITHUB_APP_PRIVATE_KEY:
    "-----BEGIN PRIVATE KEY-----\nredacted\n-----END PRIVATE KEY-----",
  GITHUB_CONTENT_REPOSITORY: "arlequins/beat",
};

describe("Beat runtime secret contract", () => {
  it("returns only the required validated keys", () => {
    const result = validateBeatRuntimeSecret({ ...valid, UNUSED: "ignored" });
    assert.deepEqual(Object.keys(result), RequiredBeatRuntimeKeys);
    assert.equal(result.UNUSED, undefined);
  });

  it("rejects missing, public HTTP, weak, and malformed values", () => {
    assert.throws(() =>
      validateBeatRuntimeSecret({ ...valid, BEAT_GOURMET_ACTION_API_KEY: "" }),
    );
    assert.throws(() =>
      validateBeatRuntimeSecret({
        ...valid,
        BEAT_AUTH_ISSUER_URL: "http://api.example.com/auth",
      }),
    );
    assert.throws(() =>
      validateBeatRuntimeSecret({
        ...valid,
        BEAT_AUTH_SIGNING_PRIVATE_JWK: "{}",
      }),
    );
    assert.throws(() =>
      validateBeatRuntimeSecret({ ...valid, GITHUB_APP_ID: "not-numeric" }),
    );
  });
});
