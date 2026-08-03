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
```

The Agent verifier discovers `/.well-known/openid-configuration`, reads
`/jwks`, and requires the `admin` role before opening the agent stream. Access
tokens expire after ten minutes.

## Token API

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
