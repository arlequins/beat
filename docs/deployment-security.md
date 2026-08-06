# Deployment and Supply-Chain Security

## AWS OIDC Setup

Create one AWS IAM role for the protected production environment. Configure
GitHub's OIDC provider as the federated principal and restrict the `sub` claim
to `repo:OWNER/REPOSITORY:environment:production`.

Store role ARNs as GitHub variables. Role ARNs identify resources and are not credentials:

- `production` environment: `AWS_PRODUCTION_ROLE_ARN`
- `production` environment: `BEAT_RUNTIME_SECRET_ID` — name or ARN of the JSON secret consumed only by the API deployment job
- `production` environment: `BEAT_PRODUCTION_API_URL` — exact HTTPS API origin used by the post-deployment smoke test

Set `AWS_REGION` as an environment variable. Do not store AWS access keys in GitHub.

Start with the trust-policy template in [`docs/iam/github-oidc-trust-policy.json`](./iam/github-oidc-trust-policy.json). Replace placeholders and retain only the production subject before applying it. The deployment permission policy is intentionally not universal: generate it from CloudTrail during the first controlled production qualification, then constrain actions and resources to the stacks, state bucket, asset bucket, and roles owned by this repository.

## Environments and Branch Protection

Create a `production` GitHub Environment with required reviewers, prevent self-review, restrict deployment to protected release branches or tags, and configure an approval timeout. Protect `main` and `develop`, require the CI and Security checks, require review, dismiss stale approvals, and disallow force pushes.

Pull requests never receive AWS credentials and do not create cloud previews.
Only an approved manual production workflow can assume the deployment role.

## Security Checks

The Security workflow performs dependency review, CodeQL analysis, full-history secret scanning, production-license policy validation, and SPDX JSON SBOM generation. Enable GitHub's Dependency Graph, then set the repository variable `DEPENDENCY_REVIEW_ENABLED=true` to make dependency-review failures blocking. Before that opt-in, unsupported Dependency Review results are reported without failing the workflow. Repository administrators should also enable GitHub secret scanning and push protection.

The license policy rejects AGPL and GPL production dependencies by default. Adjust `scripts/check-licenses.mjs` only after legal review.

## Beat API runtime secret

Store Beat's runtime configuration as one AWS Secrets Manager JSON secret. Do not store its values in GitHub Secrets, repository variables, source files, browser-visible variables, or SST outputs.

The production deployment workflow reads the secret only after it assumes `AWS_PRODUCTION_ROLE_ARN` through GitHub OIDC. The role therefore needs `secretsmanager:GetSecretValue` only for this secret and `secretsmanager:DescribeSecret` only if required by the chosen resource policy. It must not have wildcard Secrets Manager access.

The JSON object must contain these string values:

```json
{
  "BEAT_AUTH_LOOKUP_SECRET": "...at least 32 random characters...",
  "BEAT_AUTH_ISSUER_URL": "https://api.example.com/auth",
  "BEAT_AUTH_AUDIENCE": "beat-agent",
  "BEAT_AUTH_SIGNING_PRIVATE_JWK": "{...}",
  "BEAT_AUTH_SIGNING_KEY_ID": "beat-auth-2026-01",
  "BEAT_GOURMET_ACTION_API_KEY": "...at least 32 random characters...",
  "GITHUB_APP_ID": "...",
  "GITHUB_APP_INSTALLATION_ID": "...",
  "GITHUB_APP_PRIVATE_KEY": "-----BEGIN RSA PRIVATE KEY-----\\n...",
  "GITHUB_CONTENT_REPOSITORY": "arlequins/beat"
}
```

The S3 state and ledger bucket names are not secret values. SST creates both
buckets and injects their generated names into the Lambda environment. The
workflow validates that every required secret key is a non-empty string and
writes it directly to GitHub's job environment without printing it. It is
intentionally enabled only for the protected `production` API deployment;
web, batch, and remove jobs do not read the secret.

After the first API deployment, create the initial administrator from a trusted
operator environment:

```bash
BEAT_AUTH_STATE_BUCKET=... \
BEAT_AUTH_LEDGER_BUCKET=... \
BEAT_ADMIN_BOOTSTRAP_EMAIL=admin@example.com \
BEAT_ADMIN_BOOTSTRAP_PASSWORD='a-long-unique-password' \
pnpm --filter @acme/api auth:admin:create
```

Use the `authStateBucket` and `authLedgerBucket` values printed by the
production deployment. The operator needs access to both generated buckets.
Remove the bootstrap password from the shell environment immediately after the
command.

Use the same trusted operator environment to rotate or disable an account:

```bash
pnpm --filter @acme/api auth:admin:password
pnpm --filter @acme/api auth:admin:disable
```

Password changes and disable operations increment the credential version, so
existing refresh sessions can no longer rotate. Already-issued access tokens
expire within ten minutes.

### Production storage qualification

After the first API deployment, export the generated state and ledger bucket
names in a trusted operator shell and run the deliberate production
qualification once:

```bash
BEAT_PRODUCTION_QUALIFICATION_CONFIRM=production \
pnpm --filter @acme/api auth:production:qualify
```

The command verifies bucket reachability, state versioning, one-winner
conditional updates, lifecycle visibility, and Compliance Object Lock. It
creates retained qualification objects and therefore requires the explicit
confirmation value. Preserve the JSON result as deployment evidence.

To recover a historical state object, copy it into the quarantine prefix first:

```bash
BEAT_RECOVERY_SOURCE_KEY=v1/drafts/example/head.json \
BEAT_RECOVERY_VERSION_ID=example-version-id \
pnpm --filter @acme/api auth:state:recover
```

This command never overwrites a live head. Inspect the recovered JSON under
`v1/recovery/` and perform any later promotion as a separate revision-checked
operation.

## Release automation credential

Release Please intentionally uses a separate `RELEASE_PLEASE_TOKEN` repository
secret because pull requests created with the default workflow token do not
start the repository's normal CI workflows. Use a fine-grained token or GitHub
App user token limited to this repository with Contents and Pull requests
read/write access. Never reuse an AWS, Beat administrator, or GitHub content
publication credential. A manual Release workflow run fails when this secret is
absent; push runs leave a clear inactive summary without blocking application
CI.

## Headers and CSP

The Hono API uses `secureHeaders` and strict CORS. For the statically exported web application, configure a CloudFront response-headers policy with HSTS, `X-Content-Type-Options`, `Referrer-Policy`, frame restrictions, and a tested Content Security Policy. Start CSP in report-only mode because OIDC issuer and API origins vary by generated project, then enforce it after collecting violations. Do not hard-code a template-wide production issuer.

## Application Request Guards

The Hono boundary rejects authentication request bodies larger than
`API_BODY_LIMIT_BYTES` and applies a fixed-window limiter through the
provider-neutral `RateLimitPort`. Production uses a conditionally updated S3
window so the quota is shared across Lambda instances. The bundled in-memory
adapter remains available for local development.

Production workloads should also keep API Gateway throttling enabled. A WAF
remains appropriate for edge abuse controls. Rate-limited responses use HTTP
429 with `Retry-After` and `RateLimit-*` metadata; oversized requests use HTTP
413. Health checks and CORS preflight requests are not counted.
