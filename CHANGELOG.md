# Changelog

This project adheres to [Semantic Versioning](https://semver.org/).

## [1.1.0] - 2026-07-22

### Added

- Interactive OpenAPI documentation with an API request explorer and browser E2E coverage.
- Clean Architecture feature generator for domain, port, use-case, adaptor, composition, router, and test scaffolding.
- Provider-neutral asynchronous messaging ports with in-memory and AWS adaptors.
- Retry-safe mutation support backed by idempotency keys and optimistic content versioning.
- Resilient S3 cache policies for stale reads, retry backoff, request coalescing, and observability hooks.
- Isolated database integration tests powered by Testcontainers.
- Responsive Playwright visual regression coverage for desktop and mobile layouts.
- Template doctor and feature-matrix checks for generated project qualification.

### Changed

- Standardized application errors across the service, tRPC, and Hono API layers.
- Enforced dead-code and dependency analysis in local tooling and CI.
- Expanded CI to validate database migrations, generated presets, architecture boundaries, Storybook, and browser workflows.

### Fixed

- Made template environment-file updates atomic.
- Stabilized cross-platform visual snapshots with fixed viewport baselines and platform rendering tolerance.

## [1.0.1] - 2026-04-10

### Added

- **`@acme/shared`** — cross-cutting helpers; exports `runDrizzleSeeds` from `@acme/shared/seed` for TypeScript-based Drizzle seeds (ledger table, `SST_STAGE` via `resolveDeployStage()`).
- **`@acme/types`** — shared types including `SeedContext` / `SeedRun` for seed modules.

### Changed

- **`@acme/db-backbone`** — `scripts/seed.ts` delegates to `runDrizzleSeeds`; seed files live under `packages/db-backbone/scripts/seeds/*.ts` (default export). Drizzle-related dependencies use **`catalog:`** entries.
- **Root `pnpm-workspace.yaml`** — `catalog` lists `drizzle-orm`, `drizzle-zod`, `drizzle-kit`, `postgres`, and `tsx` for consistent versions across packages.

### Docs

- Root [`README.md`](./README.md): database seed command, packages index link, pnpm catalog note.
- [`packages/README.md`](./packages/README.md), [`packages/db-backbone/README.md`](./packages/db-backbone/README.md), [`packages/shared/README.md`](./packages/shared/README.md), [`packages/types/README.md`](./packages/types/README.md).

## [1.0.0] - 2026-04-09

### Summary

- **Initial stable release.** Inspired by T3 / [create-t3-turbo](https://github.com/t3-oss/create-t3-turbo), but AWS deployment, batch jobs, and shared packages diverge significantly (see README _How this differs from a stock T3 template_).

### Included

- **Apps:** `apps/web` (Next.js static export + tRPC client), `apps/api` (TanStack Start + tRPC + Nitro on AWS), `apps/batch` (SST Step Functions + Lambda + EventBridge Cron).
- **Shared packages:** `@acme/db-backbone`, `@acme/trpc`, `@acme/ui`, `@acme/env`, `@acme/validators`, `@acme/types`, `@acme/shared`, etc.
- **Infrastructure:** SST (Ion) on AWS; `tooling/sst-bootstrap` for Secrets Manager ↔ root `.env` sync.
- **Tooling:** Turborepo, pnpm workspaces, and Biome.

### Docs

- Root README updated with tech stack, T3 divergence note, and repository layout.
