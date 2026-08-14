# GitHub Pages production frontend

Beat publishes its public, statically exported Next.js frontend at
`https://arlequins.github.io/beat/`. GitHub Pages is the sole production web
host; AWS continues to own only the API, private S3 data, Lambda functions,
and application monitoring.

## Boundary

```text
browser -> https://arlequins.github.io/beat/ -> GitHub Pages static files
        -> https://<generated-api-endpoint> -> AWS API / Lambda / private S3
```

The Pages build receives two public values:

- fixed `NEXT_PUBLIC_SITE_URL=https://arlequins.github.io/beat`
- the generated API endpoint read from existing SST state through the protected
  production OIDC role and then passed as `NEXT_PUBLIC_API_URL`

The API URL is public endpoint metadata, not a credential. Do not add runtime
secrets, AWS credentials, GitHub App keys, or any non-`NEXT_PUBLIC_*` value to
the Pages workflow. Public variables are compiled into the static bundle.

## One-time GitHub setup

In `arlequins/beat` **Settings → Pages**, set **Build and deployment → Source**
to **GitHub Actions**. Keep the repository's existing protected
`production` Environment; the Pages workflow uses that same Environment and
does not introduce development, preview, or a second cloud stage.

No API URL variable needs to be copied into GitHub. The workflow resolves the
existing API `apiUrl` output from SST state using the same protected OIDC role
as the production monitor, rejects non-HTTPS values, and exposes only that
public URL to the static build. It does not read the runtime secret value.

## Deployment and API CORS

`.github/workflows/deploy-github-pages.yml` runs only from `main` (or a manual
dispatch), builds `apps/web` with `GITHUB_PAGES=true`, and publishes `out/`
using GitHub's Pages artifact actions. The Next.js base path is `/beat` only in
that build; local development stays at `/`.

The Pages origin sent by browsers is `https://arlequins.github.io`, not the
`/beat` path. The protected API SST workflow reads `API_CORS_ORIGINS` from the
production Environment and passes the normalized, exact comma-separated
origins to the Hono application. Hono is the single CORS boundary for direct
Lambda Function URLs; AWS Function URL CORS is disabled so the browser never
receives duplicate `Access-Control-Allow-Origin` values. Set the Pages origin
plus the final Beat Agent origin. It also passes the Pages site URL to the
Lambda for generated public links. After merging this change:

1. let the protected Pages workflow publish successfully;
2. run **Production infrastructure diff** for `api` from the same `main` SHA;
3. review the API-only diff, then run **Production deployment** with that exact
   reviewed SHA; and
4. verify public pages, Google SSO at `/admin/` and token refresh, Gourmet reads, and an
   upload preflight from the Pages URL.

The API deployment and all AWS operations remain GitHub Actions + OIDC only.
Do not run SST, AWS CLI, or an ad-hoc CORS update locally.

## Monitoring and rollback

The production monitor checks the Pages URL directly and resolves only the API
URL from SST state. It no longer reads web SST state or deploys a CloudFront
site.

The previous CloudFront distribution was retired after Pages and API CORS were
observed in production. The protected `beat-sst-aws` inventory and retirement
workflows verified the exact `sst:app=web` and `sst:stage=production` target,
disabled it, waited for propagation, and removed only that distribution. The
versioned `web-production-*` asset bucket remains retained with its object
versions; no bucket contents were deleted. The obsolete web deployment IAM
policies were then removed through a reviewed bootstrap diff/deploy.

Do not use a local `sst remove` or delete the retained bucket as an incidental
migration side effect. Any future bucket-retention change requires its own
data-retention review and protected GitHub Actions workflow.
