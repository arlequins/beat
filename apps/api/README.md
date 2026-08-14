# Hono API

The production Beat API provides S3-backed administrator identity, rotating
tokens, health checks, and GitHub content automation. It does not require
PostgreSQL.

```bash
pnpm --filter @arlequins/api dev
pnpm --filter @arlequins/api test
pnpm --filter @arlequins/api sst:deploy
```

| Path | Purpose |
| --- | --- |
| `GET /health/live` | Process liveness and request ID. |
| `GET /health/ready` | Readiness for the S3 state and immutable ledger buckets. |
| `GET /health` | Compatibility alias for liveness. |
| `GET /docs` | Interactive Scalar API reference and request client. |
| `GET /openapi.json` | OpenAPI 3.1 contract used by the API explorer. |
| `POST /api/echo` | Executable JSON request example for local and deployed verification. |
| `GET /auth/.well-known/openid-configuration` | Beat issuer discovery. |
| `GET /auth/jwks` | ES256 token verification keys. |
| `POST /auth/login` | Administrator login and initial token pair. |
| `POST /auth/token` | Atomic refresh-token rotation. |
| `POST /auth/revoke` | Refresh-session revocation. |
| `GET /admin/content/drafts/:slug` | Read the current S3 draft revision. |
| `PUT /admin/content/drafts/:slug` | Save an immutable revision and conditionally move its head. |
| `POST /admin/content/drafts/:slug/confirm` | Confirm a revision and open its GitHub review PR. |

Open `http://localhost:45100/docs`, select an operation, and use the request
client to send it to the current API host. The explorer persists authorization
locally so protected HTTP operations can reuse a bearer token when they are
added.

`src/app.ts` is runtime-independent. `src/dev.ts` serves it with Node for local
development and `src/lambda.ts` adapts the same app to AWS Lambda. The
production SST stack provisions a versioned state bucket and an Object
Lock-enabled ledger bucket. See
[S3-primary production architecture](../../docs/s3-primary-data-architecture.md).

## AWS deployment presets

Set `API_DEPLOYMENT_PRESET` before running `pnpm --filter @arlequins/api sst:deploy`.

| Preset | Best fit | Throttling | WAF | Custom domain |
| --- | --- | --- | --- | --- |
| `function-url` (default) | Internal APIs, prototypes, and low-traffic services that favor minimum cost and configuration | No API-level throttle. Use reserved concurrency or application controls. | Set `API_WAF_ENABLED=true` to add an SST Router backed by CloudFront and WAF. | `API_CUSTOM_DOMAIN` adds the same Router edge layer. |
| `api-gateway` | Public APIs that need managed access logs, route controls, and request throttling | `API_THROTTLE_RATE_LIMIT` and `API_THROTTLE_BURST_LIMIT`; defaults are 100 and 200. | API Gateway HTTP APIs do not accept the template's direct WAF option. Add CloudFront/WAF in front or use a REST API when direct API Gateway WAF association is required. | `API_CUSTOM_DOMAIN` configures the API Gateway domain directly. |

Examples:

```dotenv
# Direct Lambda Function URL
API_DEPLOYMENT_PRESET=function-url

# Function URL behind CloudFront, WAF, and a Route 53 domain
API_DEPLOYMENT_PRESET=function-url
API_CUSTOM_DOMAIN=api.example.com
API_WAF_ENABLED=true

# API Gateway HTTP API with stage throttling
API_DEPLOYMENT_PRESET=api-gateway
API_CUSTOM_DOMAIN=api.example.com
API_THROTTLE_RATE_LIMIT=250
API_THROTTLE_BURST_LIMIT=500
```

The deployment rejects throttling on `function-url` and direct WAF on `api-gateway` so unsupported combinations do not silently produce an unprotected endpoint. CORS remains in Hono for identical local and AWS behavior.
