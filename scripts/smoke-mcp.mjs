#!/usr/bin/env node

const baseUrl = process.argv[2]?.replace(/\/$/, "");
const expectedResource =
  process.argv[3]?.replace(/\/$/, "") ?? `${baseUrl}/mcp`;

if (!baseUrl || !expectedResource) {
  throw new Error(
    "Usage: node scripts/smoke-mcp.mjs API_URL [EXPECTED_RESOURCE]",
  );
}

for (const value of [baseUrl, expectedResource]) {
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error(`Production MCP endpoint must use HTTPS: ${value}`);
  }
}

async function requestJson(url, init) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json().catch(() => undefined);
  return { body, response };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const metadataUrl = `${baseUrl}/.well-known/oauth-protected-resource/mcp`;
const metadataResult = await requestJson(metadataUrl);
assert(
  metadataResult.response.ok,
  `Protected-resource metadata returned ${metadataResult.response.status}`,
);
const metadata = metadataResult.body;
assert(
  metadata?.resource === expectedResource,
  "Protected-resource metadata does not match the configured MCP resource",
);
assert(
  Array.isArray(metadata.authorization_servers) &&
    metadata.authorization_servers.length > 0,
  "Protected-resource metadata did not advertise an authorization server",
);
assert(
  metadata.scopes_supported?.includes("gourmet:read") &&
    metadata.scopes_supported?.includes("gourmet:write"),
  "Protected-resource metadata is missing Gourmet scopes",
);

const issuer = String(metadata.authorization_servers[0]).replace(/\/$/, "");
const discoveryResult = await requestJson(
  `${issuer}/.well-known/openid-configuration`,
);
assert(
  discoveryResult.response.ok,
  `OIDC discovery returned ${discoveryResult.response.status}`,
);
const discovery = discoveryResult.body;
assert(discovery?.issuer === issuer, "OIDC discovery issuer mismatch");
for (const field of [
  "authorization_endpoint",
  "token_endpoint",
  "revocation_endpoint",
  "end_session_endpoint",
]) {
  assert(
    typeof discovery[field] === "string" && discovery[field].length > 0,
    `OIDC discovery is missing ${field}`,
  );
}
assert(
  discovery.resource_parameter_supported === true,
  "OIDC discovery does not advertise the resource parameter",
);

const rpcHeaders = {
  "content-type": "application/json",
  "MCP-Protocol-Version": "2025-06-18",
};
const initialize = await requestJson(`${baseUrl}/mcp`, {
  method: "POST",
  headers: rpcHeaders,
  body: JSON.stringify({
    id: "smoke-initialize",
    jsonrpc: "2.0",
    method: "initialize",
    params: { protocolVersion: "2025-06-18" },
  }),
});
assert(
  initialize.response.ok &&
    initialize.body?.result?.serverInfo?.name === "beat-gourmet",
  "MCP initialize did not return the Beat Gourmet server",
);

const toolsList = await requestJson(`${baseUrl}/mcp`, {
  method: "POST",
  headers: rpcHeaders,
  body: JSON.stringify({
    id: "smoke-tools-list",
    jsonrpc: "2.0",
    method: "tools/list",
  }),
});
assert(
  toolsList.response.status === 401,
  `Unauthenticated tools/list returned ${toolsList.response.status}`,
);
const challenge = toolsList.response.headers.get("www-authenticate") ?? "";
assert(
  challenge.includes("resource_metadata=") &&
    challenge.includes('error="invalid_token"'),
  "Unauthenticated tools/list did not return an OAuth challenge",
);

const toolCall = await requestJson(`${baseUrl}/mcp`, {
  method: "POST",
  headers: rpcHeaders,
  body: JSON.stringify({
    id: "smoke-tool-call",
    jsonrpc: "2.0",
    method: "tools/call",
    params: { arguments: {}, name: "gourmet_get_context" },
  }),
});
assert(
  toolCall.response.ok &&
    toolCall.body?.result?.isError === true &&
    Array.isArray(toolCall.body?.result?._meta?.["mcp/www_authenticate"]),
  "Unauthenticated tools/call did not return the MCP OAuth signal",
);

console.log(`MCP OAuth boundary checks passed: ${baseUrl}/mcp`);
