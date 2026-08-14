import assert from "node:assert/strict";
import test from "node:test";

import { validateProductionHandoff } from "./validate-production-handoff.mjs";

const valid = {
  NEXT_PUBLIC_BEAT_APP_URL: "https://arlequins.github.io/beat-agent",
  API_CORS_ORIGINS: "https://arlequins.github.io",
  BEAT_AUTH_CLIENTS_JSON: JSON.stringify([
    {
      client_id: "beat-agent-web",
      redirect_uris: ["https://arlequins.github.io/beat-agent/auth/callback/"],
      post_logout_redirect_uris: [
        "https://arlequins.github.io/beat-agent/auth/logout-callback/",
      ],
      scopes: ["openid", "profile", "email", "offline_access"],
    },
  ]),
};

test("validates the exact Agent callback and logout contract", () => {
  assert.deepEqual(validateProductionHandoff(valid), {
    agentOrigin: "https://arlequins.github.io",
    callback: "https://arlequins.github.io/beat-agent/auth/callback/",
    logoutCallback:
      "https://arlequins.github.io/beat-agent/auth/logout-callback/",
    clientId: "beat-agent-web",
  });
});

test("rejects a path-mismatched callback or wildcard CORS", () => {
  assert.throws(
    () =>
      validateProductionHandoff({
        ...valid,
        API_CORS_ORIGINS: "*",
      }),
    /must not contain \*/,
  );
  assert.throws(
    () =>
      validateProductionHandoff({
        ...valid,
        BEAT_AUTH_CLIENTS_JSON: valid.BEAT_AUTH_CLIENTS_JSON.replace(
          "/auth/callback/",
          "/wrong/callback/",
        ),
      }),
    /redirect URI must be exactly/,
  );
});
