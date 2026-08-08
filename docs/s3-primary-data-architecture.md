# S3-primary production architecture

Beat can run without PostgreSQL, Neon, DynamoDB, or Vercel. This design uses
Amazon S3 as the primary persistence service while keeping GitHub as the
publication system of record for reviewed MDX content.

This is intentionally a small-system design for three to five administrators,
low write concurrency, and production-only operation. It is not a general
replacement for a relational database.

## Decision

Use two application data buckets with different guarantees:

| Bucket | Data | Mutation model |
| --- | --- | --- |
| `beat-ledger-production` | Authentication, authorization, review, and publication events | Append-only objects protected by Object Lock |
| `beat-state-production` | Current administrator state, authorization codes, refresh sessions, rate-limit windows, drafts, and job state | Versioned objects updated with ETag conditional writes |

The deployed static site remains in its SST-managed S3 and CloudFront resources.
It is not an application database.

Amazon S3 provides strong read-after-write consistency for successful object
writes, reads, and listings. Updates to one key are atomic. Conditional writes
with `If-None-Match` and `If-Match` provide create-if-absent and
compare-and-swap behavior for a single object. Beat relies on those guarantees,
but never assumes a transaction across multiple keys.

## System boundary

```text
Browser
  |
  | first-party login + rotating refresh token
  v
Beat identity API on Lambda
  |-- Secrets Manager: ES256 signing key and lookup secret
  |-- state bucket: refresh sessions, rate limits, current admin state
  `-- ledger bucket: immutable security events

Beat administration API on Lambda
  |-- state bucket: drafts and publishing jobs
  |-- ledger bucket: immutable review and publishing events
  `-- GitHub App: branch, commit, pull request, and review status

GitHub main branch
  `-- GitHub Actions -> static build -> S3 + CloudFront

Beat Agent
  `-- verifies Beat JWTs through issuer discovery and JWKS
```

GitHub is authoritative for published content. S3 is authoritative for Beat
identity, working drafts, workflow state, and the audit trail. A pull request is
not published content, and an S3 draft is not public content.

## Bucket controls

### Immutable ledger

Create the ledger bucket with:

- S3 Versioning enabled;
- S3 Object Lock enabled at bucket creation;
- Compliance-mode per-object retention, initially 365 days;
- S3 default encryption;
- Block Public Access enabled;
- bucket-owner-enforced object ownership;
- TLS-only bucket policy;
- no delete, overwrite, or retention-bypass permission in the Lambda execution
  role;
- `If-None-Match: *` required for application writes;
- production removal protection and retained resources.

Object Lock is irreversible at the bucket level and depends on versioning.
Compliance retention also prevents the account root user from deleting a
protected object version before its retention date. Choose the retention period
before the first production deployment.

### Mutable state

Create the state bucket with:

- S3 Versioning enabled;
- S3 default encryption;
- Block Public Access and bucket-owner-enforced ownership;
- TLS-only access;
- application writes allowed only with `If-None-Match` or `If-Match`;
- lifecycle expiry for authorization codes, refresh sessions, rate-limit
  windows, abandoned draft revisions, and noncurrent versions;
- no `DeleteObjectVersion` permission in the application role.

Do not enable a default Object Lock retention on this bucket. Refresh sessions,
authorization codes, and heads must be replaced as their state changes.
Versioning supplies recovery and CloudTrail data events supply an independent
record of every state mutation.

## Key model

Keys must be deterministic. Personally identifying values are represented by an
HMAC-SHA-256 lookup key using a secret dedicated to lookup-key generation.

```text
# Mutable state bucket
v1/admins/by-email/{emailHmac}.json
v1/oauth/codes/{codeSha256}.json
v1/oauth/sessions/{sessionId}.json
v1/rate-limit/login-ip/{ipHmac}/{window}.json
v1/rate-limit/login-user/{emailHmac}/{window}.json
v1/drafts/{postId}/head.json
v1/publication-jobs/{idempotencyKey}.json
v1/gourmet/entries/{entryId}/head.json
v1/gourmet/entries/{entryId}/revisions/{revision}.json

# Immutable ledger bucket
v1/events/auth/{yyyy}/{mm}/{dd}/{timestamp}-{eventId}.json
v1/events/content/{yyyy}/{mm}/{dd}/{timestamp}-{eventId}.json
v1/events/gourmet/{yyyy}/{mm}/{dd}/{timestamp}-{eventId}.json
v1/events/system/{yyyy}/{mm}/{dd}/{timestamp}-{eventId}.json
```

Every JSON object includes `schemaVersion`, `eventId` or `revision`,
`occurredAt`, and a SHA-256 digest where it references another object. Runtime
validation rejects unknown schema versions and malformed fields. The API never
loads administrator state by listing every event.

## Administrator state

`v1/admins/by-email/{emailHmac}.json` is the login projection:

```json
{
  "schemaVersion": 1,
  "revision": 4,
  "subject": "54dad72f-8c3d-43dd-8f47-7a5d2248e148",
  "email": "admin@example.com",
  "passwordHash": "scrypt$v=1$N=16384$r=8$p=1$...",
  "status": "active",
  "role": "admin",
  "credentialVersion": 2,
  "updatedAt": "2026-07-30T12:00:00.000Z",
  "lastCommandId": "01J..."
}
```

Email changes are represented as disabling the old login identity and creating
a new one. This avoids a transaction between secondary-index objects.

An administrator command follows this protocol:

1. Generate a server-side command ID and write an immutable intent event with
   `If-None-Match: *`.
2. Read the current state and its ETag.
3. Validate the expected revision and authorization policy.
4. Replace the state using `If-Match: <etag>`, or create it using
   `If-None-Match: *`.
5. Write an immutable applied or rejected result event.
6. Return success only after the result event is durable.

A `412 Precondition Failed` is a conflict, not a server error. The API rereads
state and retries a bounded number of times for token rotation; human edits
return `409 Conflict` with the current revision.

Because S3 has no multi-object transaction, a scheduled reconciler finds intent
events without results. State objects contain `lastCommandId`, revision, and
the relevant digest so the reconciler can classify interrupted commands and
write the missing result. CloudTrail data events remain the independent record
if a process stops between the state write and result event.

## Identity and token lifecycle

Beat is the sole identity provider for Beat and Beat Agent. It exposes:

```text
GET  /auth/.well-known/openid-configuration
GET  /auth/jwks
POST /auth/login
POST /auth/token
POST /auth/revoke
```

The browser sends credentials directly to Beat's identity endpoint. Beat Agent
does not create accounts, store password hashes, or receive a password through
its own API. Discovery and JWKS let Beat Agent validate Beat access tokens.

### Access token

- ES256 JWT signed with the private JWK loaded from the protected production
  runtime secret;
- ten-minute lifetime;
- exact issuer and audience;
- `sub`, `role`, `client_id`, `iat`, `exp`, and unique `jti`;
- verified offline by Beat and Beat Agent through discovery and JWKS.

Disabling an administrator stops new code and token issuance immediately.
Already-issued access tokens remain valid for at most ten minutes.

### Refresh token

Use an opaque value formatted as `{sessionId}.{generation}.{secret}`. Store only
an HMAC of `secret`, never the token itself.

The session object contains:

```json
{
  "schemaVersion": 1,
  "generation": 7,
  "subject": "54dad72f-8c3d-43dd-8f47-7a5d2248e148",
  "clientId": "beat-admin-web",
  "secretHash": "...",
  "credentialVersion": 2,
  "status": "active",
  "expiresAt": "2026-08-29T12:00:00.000Z",
  "lastUsedAt": "2026-07-30T12:00:00.000Z"
}
```

For each refresh:

1. Read the session and ETag.
2. Verify the presented secret, expiry, client ID, administrator status, and
   credential version.
3. Generate a new secret and replace the session with
   `If-Match: <etag>`, incrementing `generation`.
4. Return the new access and refresh tokens only after the conditional write
   succeeds.
5. Treat a failed conditional write or an older secret as possible reuse,
   conditionally revoke the current session, and require a new login.
6. Append a security event without recording either token.

Refresh sessions have a maximum lifetime of 30 days. Password changes increment
`credentialVersion`, invalidating all older refresh sessions. Logout replaces
one session with `status: revoked`; logout-all increments the administrator
credential version. Access tokens are not stored or queried per request.

The product requirement currently keeps tokens in browser `localStorage`.
Restrict that storage to the administration or Agent origin, do not load
third-party scripts there, enforce a strict Content Security Policy and Trusted
Types where supported, and clear tokens after refresh reuse or validation
failure. This reduces but does not remove the XSS exposure of `localStorage`.

## Login throttling

API Gateway throttling and AWS WAF provide the first IP-based boundary. S3
supplies a fixed window shared by every Lambda instance:

1. Derive an HMAC key from the forwarded source IP.
2. Read the current window object and ETag.
3. Increment with `If-Match`, retrying bounded conflicts.
4. Fail closed when storage is unavailable or repeated conflicts occur.
5. Expire window objects with a lifecycle rule.

Never trust an arbitrary browser-provided `X-Forwarded-For` value. Use the
source identity supplied by the Lambda/API Gateway integration.

## Draft, review, and publication

Draft editing uses immutable revision objects plus a mutable head:

```text
v1/drafts/{postId}/revisions/{revisionId}.json
v1/drafts/{postId}/head.json
```

The revision is written first. The head is then moved with `If-Match`; failed
head updates produce `409 Conflict` and preserve both authors' revisions.

Confirmation creates a publication job with an idempotency key. A worker:

1. reads the confirmed revision;
2. generates or updates the MDX and localization data;
3. obtains a short-lived GitHub App installation token;
4. creates a branch and commit;
5. opens a pull request with the revision digest;
6. records the PR URL and status in the publication job;
7. appends an immutable publication event.

GitHub review and CI remain the approval gate. Only a merge to `main` triggers
the static production build. Periodic reconciliation reads GitHub PR state and
updates the S3 job using ETag conditional writes.

## Read patterns and limits

S3 is suitable here because every online lookup has a deterministic key. Do not
add features that require joins, arbitrary filters, full-text search, globally
ordered writes, or high-frequency counters without reevaluating this decision.

Operational limits for this design:

- three to five administrators;
- low concurrent write volume;
- one aggregate updated atomically at a time;
- no cross-object transaction assumed;
- bounded retries with idempotency keys;
- no request path that lists the entire ledger;
- background inventory, audit, and repair may use paginated listings.

If these limits no longer hold, migrate mutable state behind its existing
application ports to DynamoDB or PostgreSQL. The immutable S3 ledger can remain.

## Recovery and operations

- If account-level CloudTrail data events are required, configure them in the
  `beat-sst-aws` account baseline and deliver them to its separately protected
  audit destination. The application stack does not create a competing trail.
- Alarm on authentication failures, conditional-write conflicts, reconciliation
  backlog, GitHub publication failures, KMS errors, and unexpected object
  deletion attempts.
- Verify Object Lock status periodically; add S3 Inventory through the account
  baseline only when its destination and retention policy are approved.
- Retain state-bucket noncurrent versions long enough to investigate incidents.
- Test point-in-time recovery by restoring selected object versions to a
  separate recovery prefix.
- Optionally replicate the ledger to a second Region with Object Lock enabled.
- Protect KMS keys from immediate deletion; losing the key makes retained
  objects unreadable.

## Implementation status

Implemented in Beat:

- SST-provisioned versioned state and Object Lock ledger buckets with
  least-privilege Lambda access;
- deterministic administrator lookup without event-list replay;
- runtime state validation and ETag conditional writes;
- administrator creation, password rotation, and disable operations;
- ten-minute ES256 access tokens;
- 30-day opaque refresh sessions with rotation, reuse detection, and
  revocation;
- S3-backed login rate-limit windows shared by Lambda instances;
- immutable draft revisions, conditional draft heads, confirmation, and
  idempotent publication-job state;
- an administrator web console that persists the rotating token pair in
  `localStorage` and opens a GitHub content-review pull request;
- storage readiness checks, deployment secret loading, unit tests, and a
  75-percent API coverage gate;
- a production-only scheduled reconciler that replays pending GitHub
  publication jobs, records merged or closed PR state, and produces immutable
  evidence for every durable state-object version without reading its body;
- reconciliation alarms and an isolated version-recovery command; account-wide
  CloudTrail and any S3 Inventory remain baseline-owned;
- an explicit real-AWS qualification command for conditional writes,
  versioning, lifecycle configuration, and Compliance Object Lock.

Still required before live production traffic:

1. Run the production qualification against the deployed buckets and retain
   its output with the deployment evidence.
2. Exercise concurrent refresh, administrator disablement, state-version
   recovery, GitHub PR reconciliation, and mobile Gourmet publication against
   the live production API.
3. Verify the baseline-owned CloudTrail delivery when it is enabled, then
   subscribe the alarm topic to an operator destination.
4. Move ES256 signing from a private JWK runtime secret to AWS KMS if the
   operational complexity is acceptable.

Unit tests with mocked S3 clients are necessary but are not sufficient evidence
for conditional-write or Object Lock behavior.

## AWS references

- [Amazon S3 data consistency model](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html#ConsistencyModel)
- [S3 conditional writes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html)
- [Enforcing conditional writes with bucket policy](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes-enforce.html)
- [S3 Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html)
- [S3 Versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html)
- [S3 Event Notification delivery semantics](https://docs.aws.amazon.com/AmazonS3/latest/userguide/EventNotifications.html)
