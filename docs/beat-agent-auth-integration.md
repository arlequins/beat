# Beat Agent authentication integration

Beat is the only identity issuer. Beat Agent must not create users, issue tokens,
or store administrator credentials. It accepts Beat's short-lived access JWTs.

Set these Agent production values to the Beat API values:

```dotenv
OIDC_ISSUER_URL=https://api.example.com/auth
OIDC_AUDIENCE=beat-agent
OIDC_ALLOWED_ALGORITHMS=ES256
NEXT_PUBLIC_OIDC_AUTHORITY=https://api.example.com/auth
```

The Agent verifier discovers `/.well-known/openid-configuration`, then reads
`/jwks`. It must require the `admin` role before opening the agent stream.
Beat access tokens expire after ten minutes. An administrator disabled by a new
immutable S3 event cannot obtain another token; existing access ends at expiry.

## Immutable administrator events

Write JSON objects beneath `s3://<BEAT_AUTH_EVENTS_BUCKET>/<BEAT_AUTH_EVENTS_PREFIX>/`.
Object names must sort by time, for example `2026-07-30T10:00:00.000Z-uuid.json`.

```json
{"at":"2026-07-30T10:00:00.000Z","type":"admin-created","email":"admin@example.com","subject":"uuid","passwordHash":"scrypt$SALT$HASH"}
```

Use `admin-password-changed` with the same shape to replace a password, and
`admin-disabled` with `at`, `type`, `email`, and `subject` to disable access.
Never overwrite or delete an event.
