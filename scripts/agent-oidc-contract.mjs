import process from "node:process";

function requireHttps(value, label) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(`${label} must use HTTPS`);
  return url;
}

export async function checkAgentOidcContract({
  apiUrl,
  agentUrl,
  request = fetch,
}) {
  const api = requireHttps(apiUrl, "API endpoint");
  const agent = requireHttps(agentUrl, "Agent endpoint");
  const [agentResponse, discoveryResponse] = await Promise.all([
    request(agent, { redirect: "follow" }),
    request(new URL("/auth/.well-known/openid-configuration", api), {
      redirect: "follow",
    }),
  ]);
  if (!agentResponse.ok)
    throw new Error(`Agent entry returned HTTP ${agentResponse.status}`);
  if (!discoveryResponse.ok)
    throw new Error(`OIDC discovery returned HTTP ${discoveryResponse.status}`);
  const discovery = await discoveryResponse.json();
  for (const field of [
    "authorization_endpoint",
    "token_endpoint",
    "revocation_endpoint",
    "end_session_endpoint",
  ])
    if (typeof discovery[field] !== "string" || !discovery[field])
      throw new Error(`OIDC discovery is missing ${field}`);
  if (discovery.issuer !== new URL("/auth", api).toString().replace(/\/$/, ""))
    throw new Error("OIDC issuer does not match the production API");
  if (!discovery.scopes_supported?.includes("offline_access"))
    throw new Error("OIDC discovery does not support offline_access");
  if (!discovery.id_token_signing_alg_values_supported?.includes("ES256"))
    throw new Error("OIDC discovery does not advertise ES256");
  if (
    agent.href.includes("access_token=") ||
    agent.href.includes("refresh_token=") ||
    agent.href.includes("id_token=")
  )
    throw new Error("Agent URL must not contain tokens");
  return {
    agentUrl: agent.toString(),
    issuer: discovery.issuer,
    scopes: discovery.scopes_supported,
    status: "ok",
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [apiUrl, agentUrl] = process.argv.slice(2);
  if (!apiUrl || !agentUrl) {
    console.error(
      "Usage: node scripts/agent-oidc-contract.mjs API_URL AGENT_URL",
    );
    process.exit(2);
  }
  try {
    console.log(
      JSON.stringify(await checkAgentOidcContract({ apiUrl, agentUrl })),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
