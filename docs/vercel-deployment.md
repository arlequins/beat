# Vercel deployment

Deploy the web and API as two Vercel projects from the same repository. This
keeps the Next.js application static while the Hono API runs in a Node.js
Function. It is suitable for a personal, non-commercial portfolio on Vercel's
Hobby plan.

## Before deploying

1. Create a Neon PostgreSQL database and copy its pooled connection details.
2. Register production callback URLs with the OIDC provider after Vercel gives
   you the web URL:
   - `https://YOUR_WEB_DOMAIN/auth/callback/`
   - `https://YOUR_WEB_DOMAIN/auth/logout-callback/`
3. Run database migrations against Neon from a trusted local environment:

   ```bash
   DATABASE_HOST=... DATABASE_PORT=5432 DATABASE_USER=... DATABASE_PASSWORD=... DATABASE_NAME=... DATABASE_SSL_MODE=require pnpm db:migrate
   ```

Use the Neon pooled hostname and set `POSTGRES_POOL_MAX=1` in the API project
to limit idle connections in the serverless runtime.

## API project

1. In Vercel, create a project from this repository and set **Root Directory**
   to `apps/api`.
2. Keep the checked-in `vercel.json`; it installs dependencies from the pnpm
   workspace root and builds the API together with its internal dependencies.
3. Add these production environment variables:

   ```dotenv
   DATABASE_HOST=YOUR_NEON_POOLED_HOST
   DATABASE_PORT=5432
   DATABASE_USER=YOUR_NEON_USER
   DATABASE_PASSWORD=YOUR_NEON_PASSWORD
   DATABASE_NAME=YOUR_NEON_DATABASE
   DATABASE_SSL_MODE=require
   POSTGRES_POOL_MAX=1
   OIDC_ISSUER_URL=https://YOUR_OIDC_ISSUER
   OIDC_AUDIENCE=YOUR_API_AUDIENCE
   OIDC_ALLOWED_ALGORITHMS=RS256
   API_CORS_ORIGINS=https://YOUR_WEB_DOMAIN
   SST_STAGE=production
   ```

   Add `OIDC_JWKS_URI` only when the provider does not expose standard OIDC
   discovery. Do not add any `NEXT_PUBLIC_*` variables to this project.
4. Deploy and save the resulting API URL, for example
   `https://YOUR_API.vercel.app`.

Vercel detects the default export in [`apps/api/src/app.ts`](../apps/api/src/app.ts).
It is the same Hono application used by the local Node server and AWS Lambda
adapter, so `/health/live`, `/docs`, `/openapi.json`, and `/api/trpc/*` remain
available.

## Web project

1. Create a second Vercel project from the same repository and set **Root
   Directory** to `apps/web`.
2. Keep the checked-in `vercel.json`; the project builds the static `out`
   directory created by Next.js.
3. Add these production environment variables:

   ```dotenv
   NEXT_PUBLIC_SITE_URL=https://YOUR_WEB_DOMAIN
   NEXT_PUBLIC_API_URL=https://YOUR_API.vercel.app
   NEXT_PUBLIC_OIDC_AUTHORITY=https://YOUR_OIDC_ISSUER
   NEXT_PUBLIC_OIDC_CLIENT_ID=YOUR_PUBLIC_SPA_CLIENT_ID
   NEXT_PUBLIC_OIDC_SCOPE=openid profile email
   # Set only when your provider uses OAuth Resource Indicators.
   # NEXT_PUBLIC_OIDC_RESOURCE=YOUR_API_AUDIENCE
   ```

4. Deploy the web project. After its first deployment, replace
   `API_CORS_ORIGINS` in the API project with the exact production URL and
   redeploy the API.

`NEXT_PUBLIC_*` values are compiled into the static JavaScript bundle. They are
safe only for public URLs, identifiers, and scopes; never put database or OIDC
client secrets in the web project.

## Portfolio scope

The included S3 cache, file uploads, batch workflows, and SST infrastructure
are optional. For an all-free portfolio deployment, leave S3 cache and upload
variables unset and do not deploy the batch app. Use seeded public data or add
an OIDC provider only if visitors need sign-in.

## Verification

After both projects are deployed, check:

```bash
curl -fsS https://YOUR_API.vercel.app/health/live
curl -fsS https://YOUR_API.vercel.app/health/ready
```

Then open the web URL and verify that its browser requests to `/api/trpc` are
accepted by the API. If the browser reports a CORS error, compare
`API_CORS_ORIGINS` with the exact web URL, including `https` and excluding a
trailing slash.
