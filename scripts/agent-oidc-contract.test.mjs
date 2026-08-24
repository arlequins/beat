import assert from "node:assert/strict";
import test from "node:test";

import { checkAgentOidcContract } from "./agent-oidc-contract.mjs";

const apiUrl = "https://api.example.com/";
const agentUrl = "https://arlequins.github.io/beat-agent/";

function request(input) {
  const url = String(input);
  if (url === agentUrl)
    return new Response("<html>Beat Agent</html>", { status: 200 });
  return Response.json({
    authorization_endpoint: "https://api.example.com/auth/authorize",
    end_session_endpoint: "https://api.example.com/auth/logout",
    id_token_signing_alg_values_supported: ["ES256"],
    issuer: "https://api.example.com/auth",
    revocation_endpoint: "https://api.example.com/auth/revoke",
    scopes_supported: ["openid", "profile", "offline_access"],
    token_endpoint: "https://api.example.com/auth/token",
  });
}

test("checks the Agent and Beat OIDC contract", async () => {
  await assert.doesNotReject(
    checkAgentOidcContract({ apiUrl, agentUrl, request }),
  );
});

test("rejects a discovery document without refresh scope", async () => {
  await assert.rejects(
    checkAgentOidcContract({
      apiUrl,
      agentUrl,
      request: async (input) => {
        const response = request(input);
        if (String(input).includes("openid-configuration")) {
          const body = await response.json();
          delete body.scopes_supported;
          return Response.json(body);
        }
        return response;
      },
    }),
    /offline_access/,
  );
});
