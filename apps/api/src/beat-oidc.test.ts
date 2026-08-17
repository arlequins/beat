import { afterEach, describe, expect, it, vi } from "vitest";

import {
  authorizationForm,
  BeatOidcRequestError,
  configuredBeatOidcClients,
  validateAuthorizationRequest,
  validateLogoutRequest,
} from "./beat-oidc";

const clients = JSON.stringify([
  {
    client_id: "beat-agent-web",
    redirect_uris: ["https://agent.example.com/auth/callback/"],
    post_logout_redirect_uris: [
      "https://agent.example.com/auth/logout-callback/",
    ],
    scopes: ["openid", "profile", "email"],
  },
]);

const mcpClients = JSON.stringify([
  {
    client_id: "chatgpt-gourmet",
    redirect_uris: ["https://chatgpt.com/connector/oauth/callback-example"],
    post_logout_redirect_uris: [
      "https://chatgpt.com/connector/oauth/callback-example",
    ],
    resources: ["https://api.example.com/mcp"],
    scopes: [
      "openid",
      "profile",
      "email",
      "offline_access",
      "gourmet:read",
      "gourmet:write",
    ],
  },
]);

afterEach(() => vi.unstubAllEnvs());

describe("Beat OIDC client contract", () => {
  it("requires exact redirect and logout URI matches", () => {
    vi.stubEnv("BEAT_AUTH_CLIENTS_JSON", clients);
    expect(
      configuredBeatOidcClients(clients).get("beat-agent-web"),
    ).toMatchObject({
      clientId: "beat-agent-web",
    });
    const request = validateAuthorizationRequest(
      {
        client_id: "beat-agent-web",
        redirect_uri: "https://agent.example.com/auth/callback/",
        response_type: "code",
        scope: "openid profile email",
        state: "state",
        nonce: "nonce",
        code_challenge: "A".repeat(43),
        code_challenge_method: "S256",
      },
      clients,
    );
    expect(request.redirectUri).toBe(
      "https://agent.example.com/auth/callback/",
    );
    expect(() =>
      validateAuthorizationRequest(
        {
          client_id: "beat-agent-web",
          redirect_uri: "https://agent.example.com/auth/callback",
          response_type: "code",
          scope: "openid",
          state: "state",
          nonce: "nonce",
          code_challenge: "A".repeat(43),
          code_challenge_method: "S256",
        },
        clients,
      ),
    ).toThrowError(BeatOidcRequestError);
    expect(() =>
      validateLogoutRequest(
        {
          client_id: "beat-agent-web",
          post_logout_redirect_uri: "https://evil.example.com/callback/",
        },
        clients,
      ),
    ).toThrowError(BeatOidcRequestError);
    expect(
      validateLogoutRequest(
        {
          client_id: "beat-agent-web",
          id_token_hint: "verified-before-validation",
          post_logout_redirect_uri:
            "https://agent.example.com/auth/logout-callback/",
        },
        clients,
      ).postLogoutRedirectUri,
    ).toBe("https://agent.example.com/auth/logout-callback/");
  });

  it("requires S256 and renders no token-bearing markup", () => {
    vi.stubEnv("BEAT_AUTH_CLIENTS_JSON", clients);
    expect(() =>
      validateAuthorizationRequest(
        {
          client_id: "beat-agent-web",
          redirect_uri: "https://agent.example.com/auth/callback/",
          response_type: "code",
          scope: "openid",
          state: "state",
          nonce: "nonce",
          code_challenge: "A".repeat(43),
          code_challenge_method: "plain",
        },
        clients,
      ),
    ).toThrowError(BeatOidcRequestError);
    const form = authorizationForm({
      client: configuredBeatOidcClients(clients).get("beat-agent-web")!,
      clientId: "beat-agent-web",
      codeChallenge: "A".repeat(43),
      codeChallengeMethod: "S256",
      nonce: "nonce",
      redirectUri: "https://agent.example.com/auth/callback/",
      scope: ["openid"],
      state: "state",
    });
    expect(form).toContain("form-action 'self'");
    expect(form).not.toContain("access_token");
    expect(form).not.toContain("refresh_token");
  });

  it("binds Gourmet scopes and the resource indicator to an exact client", () => {
    const request = validateAuthorizationRequest(
      {
        client_id: "chatgpt-gourmet",
        redirect_uri: "https://chatgpt.com/connector/oauth/callback-example",
        resource: "https://api.example.com/mcp",
        response_type: "code",
        scope: "openid profile email offline_access gourmet:read gourmet:write",
        state: "state",
        nonce: "nonce",
        code_challenge: "A".repeat(43),
        code_challenge_method: "S256",
      },
      mcpClients,
    );
    expect(request.resource).toBe("https://api.example.com/mcp");
    expect(request.scope).toContain("gourmet:write");
    expect(() =>
      validateAuthorizationRequest(
        {
          client_id: "chatgpt-gourmet",
          redirect_uri: "https://chatgpt.com/connector/oauth/callback-example",
          response_type: "code",
          scope: "openid gourmet:read",
          state: "state",
          nonce: "nonce",
          code_challenge: "A".repeat(43),
          code_challenge_method: "S256",
        },
        mcpClients,
      ),
    ).toThrowError(BeatOidcRequestError);
    expect(() =>
      validateAuthorizationRequest(
        {
          client_id: "chatgpt-gourmet",
          redirect_uri: "https://chatgpt.com/connector/oauth/callback-example",
          resource: "https://evil.example.com/mcp",
          response_type: "code",
          scope: "openid gourmet:read",
          state: "state",
          nonce: "nonce",
          code_challenge: "A".repeat(43),
          code_challenge_method: "S256",
        },
        mcpClients,
      ),
    ).toThrowError(BeatOidcRequestError);
  });

  it("accepts a pre-registered ChatGPT CIMD URL as an exact client id", () => {
    const clientId = "https://chatgpt.com/oauth/example/client.json";
    const raw = mcpClients.replace(
      '"chatgpt-gourmet"',
      JSON.stringify(clientId),
    );
    expect(configuredBeatOidcClients(raw).get(clientId)?.clientId).toBe(
      clientId,
    );
  });
});
