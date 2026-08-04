# Deployment and Supply-Chain Security

## AWS OIDC Setup

Create separate AWS IAM roles for preview and production. Configure GitHub's OIDC provider as the federated principal and restrict the `sub` claim to this repository. Preview jobs use dynamic GitHub Environments, so allow `repo:OWNER/REPOSITORY:environment:pr-*` for the preview role. Allow only `repo:OWNER/REPOSITORY:environment:production` for the production role.

Store role ARNs as GitHub variables. Role ARNs identify resources and are not credentials:

- repository: `AWS_PREVIEW_ROLE_ARN`
- `production` environment: `AWS_PRODUCTION_ROLE_ARN`
- `production` environment: `BEAT_RUNTIME_SECRET_ID` — name or ARN of the JSON secret consumed only by the API deployment job

Preview jobs remain skipped until `AWS_PREVIEW_ROLE_ARN` is configured.

Set `AWS_REGION` as an environment variable. Do not store AWS access keys in GitHub.

Start with the trust-policy template in [`docs/iam/github-oidc-trust-policy.json`](./iam/github-oidc-trust-policy.json). Replace placeholders and retain only the subject appropriate for each role before applying it. The deployment permission policy is intentionally not universal: generate it from CloudTrail after a sandbox deployment, then constrain actions and resources to the stacks, state bucket, asset bucket, and roles owned by this repository.

## Environments and Branch Protection

Create a `production` GitHub Environment with required reviewers, prevent self-review, restrict deployment to protected release branches or tags, and configure an approval timeout. Protect `main` and `develop`, require the CI and Security checks, require review, dismiss stale approvals, and disallow force pushes.

Preview deployments only run for branches in the same repository. Fork pull requests never receive AWS credentials. A closed pull request removes its `pr-NUMBER` stage.

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
preview, web, batch, and remove jobs do not read the secret.

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
