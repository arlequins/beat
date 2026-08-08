import { describe, expect, it } from "vitest";

import { parseBeatRuntimeSecret } from "./runtime-secret";

const runtimeSecret = {
  BEAT_AUTH_AUDIENCE: "beat-agent",
  BEAT_AUTH_ISSUER_URL: "https://api.example.com/auth",
  BEAT_AUTH_LOOKUP_SECRET: "lookup-secret-at-least-32-characters",
  BEAT_AUTH_SIGNING_KEY_ID: "beat-auth-2026-01",
  BEAT_AUTH_SIGNING_PRIVATE_JWK: JSON.stringify({ kty: "EC" }),
  BEAT_GOURMET_ACTION_API_KEY: "gourmet-action-key-at-least-32-chars",
  GITHUB_APP_ID: "123456",
  GITHUB_APP_INSTALLATION_ID: "987654",
  GITHUB_APP_PRIVATE_KEY:
    "-----BEGIN PRIVATE KEY-----\nredacted\n-----END PRIVATE KEY-----",
  GITHUB_CONTENT_REPOSITORY: "arlequins/beat",
};

describe("Beat Lambda runtime secret", () => {
  it("accepts exactly the required non-empty string values", () => {
    expect(
      parseBeatRuntimeSecret(
        JSON.stringify({ ...runtimeSecret, ignored: "not exported" }),
      ),
    ).toEqual(runtimeSecret);
  });

  it("rejects invalid JSON and missing runtime values", () => {
    expect(() => parseBeatRuntimeSecret("not-json")).toThrow("valid JSON");
    expect(() =>
      parseBeatRuntimeSecret(
        JSON.stringify({ ...runtimeSecret, GITHUB_APP_PRIVATE_KEY: "" }),
      ),
    ).toThrow("GITHUB_APP_PRIVATE_KEY");
  });
});
