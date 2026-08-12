# Production AWS/SST handoff

Beat uses the already deployed `beat-sst-aws` account baseline. This repository
does not create or update the account budget, anomaly monitor, account-level
S3 public-access block, Access Analyzer, GitHub OIDC provider, or the
production deployment role.

## Ownership and safety boundary

The API stack owns only its state, immutable ledger, cache, and upload buckets,
API Lambda, reconciliation Lambda, API endpoint, and application monitoring.
The batch stack owns its Lambda, Step Functions, and EventBridge resources.
GitHub Pages owns the static frontend and is not an AWS/SST application.

All application-created buckets have versioning, AES-256 default encryption,
bucket-owner-enforced ownership, every Block Public Access option, and a
TLS-only bucket policy. Production SST applications use `protect` and `retain`.
The ledger is created with Object Lock enabled before its first object.

The account baseline owns account-wide CloudTrail if it is enabled. Beat does
not create a competing account trail or audit destination.

## GitHub production Environment

Create or update the protected `production` Environment in `arlequins/beat`:

- require reviewers and prevent self-review;
- limit deployment branches to protected `main`;
- set `AWS_REGION=ap-northeast-1`;
- set `AWS_PRODUCTION_ROLE_ARN` to the ARN emitted by `beat-sst-aws`;
- set `BEAT_RUNTIME_SECRET_ARN` to the ARN emitted by `beat-sst-aws`;
- set `BEAT_AUTH_CLIENTS_JSON` to the exact public SPA client registration
  JSON after the Beat Agent callback URLs are finalized;
- set `API_CORS_ORIGINS` to a comma-separated list of exact browser origins:
  `https://arlequins.github.io` plus the final Beat Agent origin.

Both ARNs are identifiers, not credentials. Do not add AWS access keys or the
runtime JSON to GitHub Secrets, repository variables, `.env` files, or
`NEXT_PUBLIC_*` variables.

`BEAT_RUNTIME_SECRET_ARN` must be a full Secrets Manager ARN. The protected
deployment job reads its JSON only to validate the contract, deletes the runner
temporary file, and never sends the values to SST. The API Lambda receives only
that ARN and has an exact `secretsmanager:GetSecretValue` permission; it loads
the JSON in its own process before importing the application. Therefore the
values are absent from SST/Pulumi state, Lambda environment configuration,
static assets, Git, and action logs.

`BEAT_AUTH_CLIENTS_JSON` contains no secret. It is serialized into the API
Lambda as public configuration so the authorization endpoint can enforce exact
redirect and post-logout URI matches. Keep the sample values from
[`docs/beat-agent-auth-integration.md`](./beat-agent-auth-integration.md) until
the Agent production URL is known; do not invent a production callback.

## Deployment role policy handoff

Attach a separately reviewed inline or customer-managed policy to the baseline
role. Start from
[`docs/iam/beat-sst-production-deployment-policy.json`](./iam/beat-sst-production-deployment-policy.json),
replace `AWS_ACCOUNT_ID`, and replace the S3 name patterns with the exact SST
state and asset buckets after the first controlled plan. It deliberately omits
`AdministratorAccess`, wildcard Secrets Manager access, EC2, RDS/Aurora, and
all account-baseline permissions.

The policy is a constrained starting point, not a universal copy-and-paste
grant. Review every denied action from the protected diff job, add only the
specific action and resource SST reports, then use CloudTrail IAM Access
Analyzer policy generation to replace wildcards that AWS does not support at
resource level. Keep `iam:PassRole` limited to the generated Beat Lambda and
batch roles. Never grant the deployment role permission to change the OIDC
provider, its own trust policy, the account public-access block, budget, or
anomaly monitor.

## Required production procedure

1. Merge reviewed code to `main`.
2. Run **Production infrastructure diff** from `main` for one application.
   It assumes the protected Environment role through OIDC and saves the exact
   plan as an artifact; no local `sst diff` is permitted.
3. Review the workflow log and artifact. For API, confirm the Lambda has only
   the secret ARN (not secret values), named S3 permissions, and retained
   private buckets. For batch, confirm log retention and no unneeded data
   access. GitHub Pages web delivery has no SST diff.
4. Run **Production deployment** from the same `main` commit. Paste that exact
   commit SHA into `reviewed_commit`; the workflow rejects a stale SHA.
5. The API deployment reads its generated `apiUrl` from SST state, records only
   that URL in the workflow summary, and smoke-tests it. No custom domain or
   preconfigured API URL is required. Run **Production operations**
   `qualify-storage` once after the first API deployment and retain its result.

### First API deployment without a custom domain

The generated API Gateway URL is also Beat's permanent OIDC issuer origin. On
the first deployment only, the URL does not exist yet and the empty runtime
secret therefore cannot contain the final issuer. Use this protected two-phase
bootstrap instead of a placeholder issuer:

1. Run **Production infrastructure diff** for `api`. A diff requires the exact
   secret ARN but does not read or validate a secret value.
2. Review the plan, then run **Production deployment** for the same commit with
   `bootstrap_api=true`. This option is accepted only for the production API
   deploy. It creates the retained infrastructure and reports `apiUrl`, while
   deliberately deferring runtime-secret validation and the smoke request.
3. Set the `beat-sst-aws` production Environment variable
   `BEAT_AUTH_ISSUER_URL` to the reported API URL plus `/auth`. Configure the
   protected GitHub App source secrets there and run **Initialize Beat runtime
   secret** once.
4. Run **Production deployment** again for the same reviewed commit with
   `bootstrap_api=false`. The normal path validates the complete secret and
   must pass the HTTPS API smoke test.

The bootstrap option does not write the secret, expose its values, grant the
application role write access, or replace the normal deployment path. Do not
use it after initialization.

The deploy workflow cannot be run from a pull request or another branch. It
performs no implicit deploy after a merge and no local fallback exists.

## Auth-event reader boundary

The existing Beat Lambda is the append-only event producer for the current
`v1/events/*` ledger; it requires `PutObject` and `PutObjectRetention` for that
separate writer responsibility. Do not reuse that role for an event-browser or
audit-reader API.

When a read-only auth-event endpoint is added, create a distinct execution role
from [`docs/iam/beat-auth-event-reader-policy.json`](./iam/beat-auth-event-reader-policy.json).
It permits only `s3:ListBucket` on the bucket and `s3:GetObject` under
`admins/events/*`; it contains no `PutObject`, `DeleteObject`, retention-bypass,
or wildcard S3 permissions. The `admins/events/*` prefix is intentionally not
mapped onto the existing ledger until a versioned migration is designed and
reviewed.

## Rollback and recovery

Do not use `sst remove` for production. Production resources are protected and
retained. If a deployment is unhealthy:

1. stop further deploy workflow dispatches and preserve the diff/deploy logs;
2. revert the application commit with a reviewed PR, then repeat the protected
   diff and deployment procedure for that exact rollback commit;
3. use **Production operations** `recover-state-version` only to copy a chosen
   state-object version into the recovery prefix; it never overwrites a live
   head;
4. never delete ledger object versions or reduce Object Lock retention;
5. record the incident, bucket version IDs, deployment SHA, and smoke result.

Aurora is not part of this design. If it is introduced later, require deletion
protection, automated backups, a final snapshot, private subnets, and a new
separate approval before any production deployment.
