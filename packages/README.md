# `packages/` — workspace libraries

Shared **`@acme/*`** packages consumed by `apps/*` and each other. Replace the scope when you fork.

| Package | Role |
| --- | --- |
| [`@acme/db-backbone`](./db-backbone/README.md) | Drizzle schema, postgres client, migrations, **TS seeds** (via `@acme/shared`) |
| [`@acme/env`](./env) | Zod-validated env (`serverEnv`, `clientEnv`), stages, DB URL helpers, VPC from env |
| [`@acme/shared`](./shared/README.md) | Cross-cutting utilities (e.g. `runDrizzleSeeds`) |
| [`@acme/types`](./types/README.md) | Shared TypeScript types (`SeedContext`, …) |
| `@acme/trpc` | tRPC routers and server/client wiring |
| `@acme/ui` | Shared React UI |
| `@acme/validators` | Zod schemas shared across API and web |
| `@acme/auth` | Provider-neutral OIDC access-token verification and sessions |
| `@acme/service` | Domain / application services |

Dependency versions for several tools (Drizzle, `postgres`, `tsx`, …) are centralized in the repo root [`pnpm-workspace.yaml`](../pnpm-workspace.yaml) **`catalog:`** and referenced from individual `package.json` files as `"catalog:"`.
