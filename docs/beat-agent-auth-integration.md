# Beat Agent authentication integration

Beat is the only identity issuer. Beat Agent must not create users, issue tokens,
or store administrator credentials. It accepts Beat's short-lived access JWTs
and uses Beat's opaque rotating refresh tokens.

Set these Agent production values to the Beat API values:

```dotenv
OIDC_ISSUER_URL=https://api.example.com/auth
OIDC_AUDIENCE=beat-agent
OIDC_ALLOWED_ALGORITHMS=ES256
NEXT_PUBLIC_OIDC_AUTHORITY=https://api.example.com/auth
NEXT_PUBLIC_OIDC_CLIENT_ID=beat-agent-web
NEXT_PUBLIC_OIDC_SCOPE=openid profile email offline_access
```

The Agent verifier discovers `/.well-known/openid-configuration`, reads
`/jwks`, and requires the `admin` role before opening the agent stream. Access
tokens expire after ten minutes.

## Authorization Code + PKCE (production path)

The Agent uses the standard browser Authorization Code flow with S256 PKCE.
Beat exposes these discovery fields from the issuer above:

- `authorization_endpoint`: `{issuer}/authorize`
- `token_endpoint`: `{issuer}/token`
- `revocation_endpoint`: `{issuer}/revoke`
- `end_session_endpoint`: `{issuer}/logout`

When Google SSO is configured in Beat, the authorization endpoint redirects the
browser to Google, verifies the returned identity, and resumes this same OIDC
Authorization Code + PKCE request. The Agent only sees Beat-issued OIDC
tokens; it does not integrate with Google directly.

The public client is registered by the protected production Environment variable
`BEAT_AUTH_CLIENTS_JSON`; it is not a secret and must not be placed in the
runtime secret. Use exact strings for both callbacks, including the trailing
slash:

```dotenv
BEAT_AUTH_CLIENTS_JSON=[{"client_id":"beat-agent-web","redirect_uris":["https://agent.example.com/auth/callback/"],"post_logout_redirect_uris":["https://agent.example.com/auth/logout-callback/"],"scopes":["openid","profile","email","offline_access"]}]
```

The final Agent origin replaces `https://agent.example.com` in the protected
Environment. Beat requires `response_type=code`, `state`, `nonce`,
`code_challenge`, and `code_challenge_method=S256`. The authorization form
returns only a one-time authorization code and the original state to the exact
redirect URI. The token endpoint accepts `grant_type=authorization_code` with
`code_verifier`, validates the one-time S3 record, and returns an ES256 access
JWT (`aud=beat-agent`), an opaque rotating refresh token, and an ES256 ID token
with the requested nonce. Authorization codes expire after 60 seconds and are
never logged or stored in plaintext.

For logout, revoke the refresh token first, then navigate to the end-session
endpoint with `client_id`, the exact `post_logout_redirect_uri`, and a client
state value. `oidc-client-ts` may send an `id_token_hint`; Beat verifies its
ES256 signature, issuer, and audience before using that audience to identify
the client. No access or refresh token is accepted in a URL, and the Agent must
not log callback query strings.

`offline_access` is an allowed scope so the Agent can retain its rotating
refresh session. Beat still preserves the legacy direct endpoints below for
existing administrators and local operators.

The portfolio administrator page is a separate public client. Register it in
the same `BEAT_AUTH_CLIENTS_JSON` value with these exact URIs:

```json
{"client_id":"beat-admin-web","redirect_uris":["https://arlequins.github.io/beat/admin/callback/"],"post_logout_redirect_uris":["https://arlequins.github.io/beat/admin/"],"scopes":["openid","profile","email","offline_access"]}
```

`https://arlequins.github.io/beat/admin/` starts the Google SSO flow. The
portfolio generates state, nonce, and an S256 PKCE verifier in the browser,
checks the returned Beat ID token, and never sends a password to the API.

## Legacy token API

Authenticate directly with Beat. Never send the password to the Agent API:

```http
POST https://api.example.com/auth/login
Content-Type: application/json

{"email":"admin@example.com","password":"..."}
```

The response contains `access_token`, `refresh_token`, `expires_in`,
`refresh_expires_in`, and `token_type`. Persist the pair in Agent
`localStorage`, replace both values after every successful refresh, and clear
them after any refresh failure.

Refresh with the standard token endpoint:

```http
POST https://api.example.com/auth/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&refresh_token=SESSION.GENERATION.SECRET
```

Beat rotates the refresh secret with an S3 ETag conditional write. Only one
concurrent refresh succeeds. Reuse of an older generation revokes the session
family. The Agent must replace the stored refresh token atomically before
issuing another API request.

Revoke a session during logout:

```http
POST https://api.example.com/auth/revoke
Content-Type: application/x-www-form-urlencoded

token=SESSION.GENERATION.SECRET
```

## Browser boundary

`localStorage` persistence is an explicit product requirement and exposes
tokens to JavaScript running on the Agent origin. The Agent production page
must therefore avoid third-party scripts, enforce a strict Content Security
Policy, reject untrusted HTML, and clear storage when JWT or refresh validation
fails.

Beat Agent remains a separate repository. Apply this protocol there without
copying Beat's administrator store or signing key.

## S3 ownership

Beat provisions two private production buckets:

- the state bucket contains deterministic administrator records and versioned
  refresh-session objects;
- the ledger bucket contains append-only authentication events written with
  `If-None-Match: *` and Object Lock Compliance retention.

Beat Agent receives no AWS credentials and never accesses either bucket.

## Current production handoff

The Beat Agent production web app is published at
`https://arlequins.github.io/beat-agent/`, with the API at
`https://p3akjheufygfnr54k7vhz6kria0inkun.lambda-url.ap-northeast-1.on.aws/`.
Its OIDC issuer is the API origin plus `/auth`. The portfolio's protected
GitHub Pages build uses
`NEXT_PUBLIC_BEAT_APP_URL=https://arlequins.github.io/beat-agent` and opens
that app in a new window; it never forwards an access or refresh token. These
URLs and callbacks were rechecked after the `v0.11.2` release on 2026-08-18:
the Pages app and callback both returned HTTP 200, the protected production
deployment passed, and the Google SSO and daily production contract smoke
workflows succeeded. Beat's hourly production monitor independently checks the
issuer, S256 PKCE, `offline_access`, ES256 JWKS, exact Pages CORS origin, the
unauthenticated administrator boundary, and the public Gourmet list.

Bedrock model configuration remains owned by the Agent repository. Beat does
not duplicate model identifiers, model IAM, or runtime credentials. A passing
Beat identity contract proves authentication interoperability; model-response
quality and provider availability remain separate Agent acceptance checks.
