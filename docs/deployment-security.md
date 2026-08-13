# Deployment and Supply-Chain Security

## AWS OIDC Setup

Create one AWS IAM role for the protected production environment. Configure
GitHub's OIDC provider as the federated principal and restrict the `sub` claim
to `repo:OWNER/REPOSITORY:environment:production`.

Store role ARNs as GitHub variables. Role ARNs identify resources and are not credentials:

- `production` environment: `AWS_PRODUCTION_ROLE_ARN`
- `production` environment: `BEAT_RUNTIME_SECRET_ARN` — full ARN of the JSON secret validated by the protected API plan/deploy job and read by the API Lambda at runtime

Set `AWS_REGION` as an environment variable. Do not store AWS access keys in GitHub.
The GitHub Pages workflow reads the deployed public API URL from existing SST
state through OIDC. This endpoint is compiled into the browser bundle, but no
API URL needs to be copied into an Environment variable and no credential is
made browser-visible.

Start with the trust-policy template in [`docs/iam/github-oidc-trust-policy.json`](./iam/github-oidc-trust-policy.json). Replace placeholders and retain only the production subject before applying it. The deployment permission policy is intentionally separate from the baseline role: review [`Production AWS/SST handoff`](./production-aws-sst.md), start from its bounded policy template, then constrain each action and resource from the protected production diff evidence.

The same protected role runs `Production operations`. Once the API has created
the bucket names, scope its operator permissions to the two exact buckets:
`s3:GetObject`, `s3:PutObject`, `s3:PutObjectRetention`, `s3:HeadBucket`,
`s3:HeadObject`, `s3:GetBucketLifecycleConfiguration`, and
`s3:ListBucketVersions`. Do not grant deletion permissions. Administrator
operations also require read access to the one runtime secret described below.

## Environments and Branch Protection

Create only one GitHub Environment, `production`, with required reviewers, prevent self-review, restrict deployment to `main`, and configure an approval timeout. Protect `main`, require the CI and Security checks, require review, dismiss stale approvals, and disallow force pushes. Beat has no cloud development, staging, preview, or second SST stage.

Pull requests never receive AWS credentials and do not create cloud previews.
Only an approved manual production workflow dispatched from `main` can assume
the deployment role.

## Security Checks

The Security workflow performs dependency review, CodeQL analysis, full-history secret scanning, production-license policy validation, and SPDX JSON SBOM generation. Enable GitHub's Dependency Graph, then set the repository variable `DEPENDENCY_REVIEW_ENABLED=true` to make dependency-review failures blocking. Before that opt-in, unsupported Dependency Review results are reported without failing the workflow. Repository administrators should also enable GitHub secret scanning and push protection.

The license policy rejects AGPL and GPL production dependencies by default. Adjust `scripts/check-licenses.mjs` only after legal review.

## Beat API runtime secret

Store Beat's runtime configuration as one AWS Secrets Manager JSON secret. Do not store its values in GitHub Secrets, repository variables, source files, browser-visible variables, or SST outputs.

The protected production diff/deployment workflow reads the secret only after it assumes `AWS_PRODUCTION_ROLE_ARN` through GitHub OIDC, validates it, masks its values, and deletes the runner temporary file. SST receives only `BEAT_RUNTIME_SECRET_ARN`; the API Lambda retrieves the JSON with an exact `secretsmanager:GetSecretValue` permission before importing the application. The values are never written to SST/Pulumi state, Lambda configuration, static assets, GitHub variables, or `NEXT_PUBLIC_*` values. The role must not have wildcard Secrets Manager access.

The JSON object must contain these string values:

```json
{
  "BEAT_AUTH_LOOKUP_SECRET": "...at least 32 random characters...",
  "BEAT_AUTH_ISSUER_URL": "https://api.example.com/auth",
  "BEAT_AUTH_AUDIENCE": "beat-agent",
  "BEAT_AUTH_SIGNING_PRIVATE_JWK": "{...}",
  "BEAT_AUTH_SIGNING_KEY_ID": "beat-auth-2026-01",
  "BEAT_AUTH_GOOGLE_CLIENT_ID": "...apps.googleusercontent.com",
  "BEAT_AUTH_GOOGLE_CLIENT_SECRET": "...",
  "BEAT_AUTH_GOOGLE_REDIRECT_URI": "https://api.example.com/auth/google/callback",
  "BEAT_GOURMET_ACTION_API_KEY": "...at least 32 random characters...",
  "GITHUB_APP_ID": "...",
  "GITHUB_APP_INSTALLATION_ID": "...",
  "GITHUB_APP_PRIVATE_KEY": "-----BEGIN RSA PRIVATE KEY-----\\n...",
  "GITHUB_CONTENT_REPOSITORY": "arlequins/beat"
}
```

Beat's hosted OIDC sign-in uses Google SSO. Register the exact redirect URI
`https://<beat-api-origin>/auth/google/callback` in Google Cloud Console and
keep the OAuth client ID and secret in this runtime secret. The application
accepts only the configured personal account; the default allowlist is
`tiret.rouge@gmail.com`. A verified Google email is not sufficient by itself:
the Google `sub`, issuer, audience, nonce, and email verification flag are all
checked before the Beat OIDC code is issued.

The S3 state and ledger bucket names are not secret values. SST creates both
buckets and injects their generated names into the Lambda environment. The
workflow validates every required secret key without exporting the JSON into
the SST command environment. It is intentionally enabled only for the
protected `production` API diff/deploy jobs; web, batch, and remove jobs do not
read the secret.

After the first API deployment, use only the protected
`Production operations` GitHub Actions workflow. Do not run administrator,
recovery, or qualification commands from a local shell. The scripts reject
non-GitHub execution, and the actual AWS boundary is the production-only OIDC
role.

For any administrator create or password rotation, temporarily set a unique
`BEAT_ADMIN_OPERATION_PASSWORD` secret in the `production` GitHub Environment.
Dispatch the workflow with the administrator email and the `authStateBucket`
and `authLedgerBucket` values emitted by the Production deployment. After the
run, rotate or remove that environment secret. Administrator emails are normal
workflow inputs; never enter a password as an input.

Use `disable-admin` with the target email for account disablement. The workflow
serializes all protected operations and requires a `production` confirmation.

Password changes and disable operations increment the credential version, so
existing refresh sessions can no longer rotate. Already-issued access tokens
expire within ten minutes.

### Production storage qualification

After the first API deployment, dispatch `Production operations` with
`qualify-storage`, the emitted bucket names, and the `production`
confirmation. It is deliberately not available through a local command.

The command verifies bucket reachability, state versioning, one-winner
conditional updates, lifecycle visibility, and Compliance Object Lock. It
creates retained qualification objects and therefore requires the explicit
confirmation value. Preserve the JSON result as deployment evidence.

To recover a historical state object, dispatch `Production operations` with
`recover-state-version`, the selected state key and S3 version ID. The action
copies it into the quarantine prefix first.

This command never overwrites a live head. Inspect the recovered JSON under
`v1/recovery/` and perform any later promotion as a separate revision-checked
operation.

## Release automation credential

Release Please exchanges the protected `production` Environment secrets
`BEAT_GITHUB_APP_ID` and `BEAT_GITHUB_APP_PRIVATE_KEY` for a short-lived GitHub
App installation token. The app must be installed on `arlequins/beat` and have
Contents, Pull requests, and Workflows read/write access. The existing GitHub
App installation ID is not needed by this token exchange.

The workflow explicitly requests those three write permissions while minting
its short-lived token. GitHub refuses the run if the installation has not
accepted any requested permission, rather than silently falling back to a
weaker token. GitHub's Releases API requires both Contents and Workflows write
permission for GitHub App installation tokens.

Keep these source materials separate from AWS credentials, Beat administrator
credentials, and GitHub content-publication credentials. The private key is
never logged, committed, put in SST state, or exposed to the browser. When the
two Environment secrets are absent, push-triggered release runs finish with an
explicit **Release deferred** summary instead of failing application CI. After
configuring them, run the **Release** workflow manually from `main` once to
finish any pending Release Please release.

## Headers and CSP

The Hono API uses `secureHeaders` and strict CORS. GitHub Pages manages HTTPS
for the static web host and does not provide a repository-level response-header
policy. Keep browser-visible secrets out of the export, enforce API headers and
CORS at the Hono boundary, and add a static CSP only after testing all required
API and identity origins.

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
