# Beat

Arlequin's Korean-first portfolio, technical writing workflow, and
administrator-only Beat entry point. Production runs on AWS with static
CloudFront delivery, a Hono Lambda API, and S3-primary identity and workflow
state.

## Stack

| Area | Technology |
| --- | --- |
| Workspace | pnpm catalogs, Turborepo, TypeScript, Biome |
| Web | Next.js App Router, client-only static export, React, Tailwind CSS |
| API | Hono, local Node.js server, AWS Lambda deployment |
| Primary data | Versioned S3 state and Object Lock immutable ledger |
| Authentication | Beat-issued ES256 access JWTs and rotating refresh tokens |
| Infrastructure | SST Ion, CloudFront, Lambda, Step Functions, EventBridge |
| Testing | Vitest coverage, Playwright, accessibility checks |

Internal packages use the placeholder scope `@acme/*`. The initializer replaces
it when creating a project.

## Requirements

- Node.js and pnpm versions matching [`package.json`](./package.json)
- Docker only for retained legacy PostgreSQL integration tests
- AWS credentials only for cloud-backed SST commands

Use the Node.js version in [`.nvmrc`](./.nvmrc). The preinstall check reports an
actionable error when the runtime does not match.

## Create a Project

Preview repository-wide replacements before applying them:

```bash
pnpm template:init -- --name customer-portal --display-name "Customer Portal" --scope @company --domain customer.example.org --dry-run
pnpm template:init -- --name customer-portal --display-name "Customer Portal" --scope @company --domain customer.example.org --description "Customer portal"
pnpm install
```

The initializer updates package names, SST application names, repository
metadata, and example domains. It refuses to modify a dirty worktree unless
`--force` is provided.

`--display-name` controls user-facing branding and defaults to a title-cased
version of `--name`. The generated `template.features.json` records the project
identity, selected preset, and enabled optional features for later tooling.

The default preset retains the complete template. For a smaller starting point:

```bash
pnpm template:init -- --name customer-portal --scope @company --domain customer.example.org --preset minimal --prune
pnpm install
```

The minimal preset keeps `web + api + trpc + db`. Use `--features` to select
`auth`, `batch`, `sst`, or `example-ui`. `--prune` physically removes omitted
modules and the lockfile; the next install creates a lockfile for the selected
composition.

## Local Quickstart

Start PostgreSQL, apply migrations and seeds, and launch the local OIDC provider,
API, and web app:

```bash
cp .env.localhost.example .env.localhost
pnpm install
pnpm dev:local
```

Open `http://localhost:3000`. The development identity provider accepts any
non-empty username and password. PostgreSQL uses host port `55433` by default.
Stop the database with `pnpm db:stop`.

### Static portfolio

The public portfolio and writing pages can run without PostgreSQL, API, or OIDC
while you are preparing content:

```bash
pnpm --filter @acme/web dev
```

Open `http://localhost:3000` and edit the starter content as described in
[Portfolio content](./docs/portfolio-content.md).

The production Beat API endpoints are:

- Liveness: `http://localhost:5000/health/live`
- S3-backed readiness: `http://localhost:5000/health/ready`
- Interactive API explorer: `http://localhost:5000/docs`
- OpenAPI document: `http://localhost:5000/openapi.json`
- Login: `http://localhost:5000/auth/login`
- Token refresh: `http://localhost:5000/auth/token`
- Administrator console: `http://localhost:3000/admin/`
- Gourmet records: `http://localhost:3000/gourmet/`

See [S3-primary production architecture](./docs/s3-primary-data-architecture.md)
for the production request flow and
[Beat Agent authentication integration](./docs/beat-agent-auth-integration.md)
for the shared token contract.
The [Beat Gourmet guide](./docs/gourmet.md) covers Custom GPT text capture,
S3-backed records, and repository-reviewed images.

## Common Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev:local` | Start the complete local application stack. |
| `pnpm dev` | Run development tasks when dependencies are already available. |
| `pnpm dev:sst` | Run web, API, and batch through cloud-backed SST development. |
| `pnpm check` / `pnpm check:fix` | Check or fix Biome formatting and lint rules. |
| `pnpm typecheck` | Typecheck every workspace. |
| `pnpm test` | Run unit and contract tests. |
| `pnpm test:e2e` | Run isolated PostgreSQL and browser end-to-end tests. |
| `pnpm db:setup` | Apply committed migrations and pending seeds. |
| `Production operations` GitHub Action | Create, rotate, or disable production S3 administrators. |
| `pnpm turbo gen` | Generate an application, package, or tRPC domain. |
| `pnpm gen:feature` | Generate a clean-architecture command or query slice. |

Database schema changes use:

```bash
pnpm db:create-migration --name=describe_change
pnpm db:check
```

See [`packages/db-backbone/README.md`](./packages/db-backbone/README.md) for the
migration workflow and [Database Operations](./docs/database-operations.md) for
backup, restore, and deployment ordering.

## Environment and Secrets

- `.env.localhost.example` is the complete local-stack configuration.
- `.env.example` documents shared and cloud-oriented variables.
- `pnpm env:check` verifies environment schemas and examples stay synchronized.
- `pnpm env:pull` and `pnpm env:push` synchronize supported values with AWS
  Secrets Manager.

Application code should access validated environment values through `@acme/env`
instead of reading `process.env` throughout the codebase.

## Template Qualification

Validate SST configuration without SST sign-in or AWS credentials:

```bash
cp .env.example .env
pnpm test:sst
```

Validate complete generated repositories:

```bash
pnpm test:template-output full
pnpm test:template-output minimal
```

These checks do not emulate AWS. The controlled production qualification and
deployment still require AWS credentials. See [SST Local Testing](./docs/sst-local-testing.md)
and [Template Readiness](./docs/template-readiness.md).

## Deployment

- Web builds as a static export for S3 and CloudFront.
- API deploys through a Lambda Function URL or API Gateway HTTP API preset.
- Optional batch workflows use Step Functions, Lambda, and EventBridge
  schedules.

The selected production profile uses AWS only. Neon and Vercel are not required.

Read [Deployment and Supply-Chain Security](./docs/deployment-security.md) before
configuring GitHub OIDC roles or production environments. Deployment-specific
commands and tradeoffs live in [`apps/api/README.md`](./apps/api/README.md) and
[`apps/batch/README.md`](./apps/batch/README.md).

## Documentation

Use the [documentation index](./docs/README.md) to find architecture,
development, operations, security, and engineering conventions. Package-level
details live beside their implementation under `apps/*/README.md` and
`packages/*/README.md`.

## Publishing a Fork

1. Run `pnpm template:init` and prune unused modules.
2. Replace example identity, domain, seed, and IAM values.
3. Configure branch protection, deployment environments, and cloud roles.
4. Update `LICENSE`, `NOTICE`, ownership, support, and incident contacts.
5. Run local, generated-template, and relevant cloud qualification checks.

## Changelog and License

See [CHANGELOG.md](./CHANGELOG.md). The project is available under the
[MIT License](./LICENSE), with upstream attribution in [NOTICE](./NOTICE).
