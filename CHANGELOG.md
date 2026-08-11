# Changelog

This project adheres to [Semantic Versioning](https://semver.org/).

## [1.2.0](https://github.com/arlequins/beat/compare/template-t3-turbo-sst-v1.1.2...template-t3-turbo-sst-v1.2.0) (2026-08-11)


### Features

* add Beat Gourmet records and reviewed images ([#3](https://github.com/arlequins/beat/issues/3)) ([60176a0](https://github.com/arlequins/beat/commit/60176a096d2b67feb97c141ac0c37cbe8d444c99))
* add protected AWS SST production integration ([5382ca7](https://github.com/arlequins/beat/commit/5382ca79dde6273b98f86fdd2d11a58a7cf1fff6))
* add protected Lambda runtime diagnostics ([8a51b56](https://github.com/arlequins/beat/commit/8a51b569ebc99aaebbcda0f99132cbb6462c81a7))
* add protected Lambda runtime diagnostics ([ce6c88a](https://github.com/arlequins/beat/commit/ce6c88ac52cddbbdcb4f468edd5fb62fcc759f34))
* adopt S3-primary production data ([fcf2453](https://github.com/arlequins/beat/commit/fcf245347f6c42d1b893aede604bbaebbfebb99b))
* **auth:** add Beat issuer coverage gate ([b7927de](https://github.com/arlequins/beat/commit/b7927def19b95a3d3a317512bb56fd5733820179))
* **content:** add GitHub App installation authentication ([ebbb6ad](https://github.com/arlequins/beat/commit/ebbb6ada844931dd47a107228ba29a513e7020a5))
* harden Beat production operations ([a901d7a](https://github.com/arlequins/beat/commit/a901d7a63081f41ed5ce4de847b6e4a2e88ffbdc))
* integrate Beat production AWS SST ([5a7385a](https://github.com/arlequins/beat/commit/5a7385a66fdceee17b19d9b316cbac40e625da29))
* launch Beat portfolio with S3-backed administration ([c5f025a](https://github.com/arlequins/beat/commit/c5f025abd7f62ad1b47b001655503e6148030163))
* run Beat production operations in GitHub Actions ([4226f15](https://github.com/arlequins/beat/commit/4226f156514d249939fed8f820aca5799f3fe7ea))
* **web:** add Beat chat entry point ([574664c](https://github.com/arlequins/beat/commit/574664ce311c58e4351af421f8388efe1a07a1f6))
* **web:** add content review and SEO checks ([b496c13](https://github.com/arlequins/beat/commit/b496c13445ccf83fd46d30499b1841190840d2b3))
* **web:** refine portfolio launch ([19f2287](https://github.com/arlequins/beat/commit/19f2287bf4e9d9003a734faab1da46e2912487e6))


### Bug Fixes

* build workspace dependencies before SST ([71926fd](https://github.com/arlequins/beat/commit/71926fdbbac35b780fd497fafb4f913fcf35ccf1))
* build workspace dependencies before SST ([d8e3376](https://github.com/arlequins/beat/commit/d8e33765985b52f3089bc1c8c3908f36dd4b4fb5))
* **ci:** build API dependencies before coverage ([ce6713e](https://github.com/arlequins/beat/commit/ce6713eb09d8672c13135214419154061a360dda))
* **ci:** build web dependencies before typecheck ([ad06bb8](https://github.com/arlequins/beat/commit/ad06bb8bbcddb4d3c40fd16281716b7c84282146))
* **ci:** synchronize coverage dependency lockfile ([0b0de96](https://github.com/arlequins/beat/commit/0b0de96c34054406feea81807f75be49b1d5f224))
* derive production API URL from SST state ([80ad113](https://github.com/arlequins/beat/commit/80ad113e1dddd514b82e0764af478758a990897d))
* forward SST stage arguments ([#9](https://github.com/arlequins/beat/issues/9)) ([ca72aba](https://github.com/arlequins/beat/commit/ca72abac867a02ed25b3568c3712ea6ad0648837))
* isolate Lambda from browser environment ([f8dc9cc](https://github.com/arlequins/beat/commit/f8dc9ccb9131c50e17af91d8ac293193501de4a8))
* isolate Lambda from browser environment ([1d8b938](https://github.com/arlequins/beat/commit/1d8b9385bed7eed6f391ed2cfa5713efdb21ad2c))
* load production settings inside protected job ([aaefab7](https://github.com/arlequins/beat/commit/aaefab737ccd8b2b092293693fb08178fed6a3af))
* parse noisy SST state output ([c637b66](https://github.com/arlequins/beat/commit/c637b66bd576a67a6b8de4e052f2e963483a8ed6))
* parse noisy SST state output ([ed395bf](https://github.com/arlequins/beat/commit/ed395bff651ef171f3cc40a034cdc32e9deaa060))
* pass SST options through pnpm ([#10](https://github.com/arlequins/beat/issues/10)) ([778dfe7](https://github.com/arlequins/beat/commit/778dfe71c1bb5e687624ed61e4f57c7baebf903e))
* preserve production auth state prefix ([#11](https://github.com/arlequins/beat/issues/11)) ([da8120a](https://github.com/arlequins/beat/commit/da8120a251e06d6f70394e83bca6075335471212))
* read production deployment settings in reusable job ([a592754](https://github.com/arlequins/beat/commit/a5927549dc0cf647c8aa36f02fcc7248c93585b8))
* scope production alarm names ([7138a15](https://github.com/arlequins/beat/commit/7138a159d77491a160c6432d24a00f38268312a2))
* scope production alarm names ([5ed9ea7](https://github.com/arlequins/beat/commit/5ed9ea7535673e0335065c36ff7738303b2c6213))
* set Pulumi alarm names ([4a19cea](https://github.com/arlequins/beat/commit/4a19ceaa80193c770dab9cd85c5de03fb0123a3f))
* set Pulumi alarm names ([d6d7e8c](https://github.com/arlequins/beat/commit/d6d7e8c14a77dc4c10b2da82249334705d69fcc0))
* support first production API bootstrap ([60f5416](https://github.com/arlequins/beat/commit/60f5416ee3664cc093da8840618affb3e3cfe3da))
* support generated API issuer bootstrap ([0d1aba5](https://github.com/arlequins/beat/commit/0d1aba5c777537e43b41887a1adc1708d8869754))
* use repository token for release automation ([#19](https://github.com/arlequins/beat/issues/19)) ([787f8b2](https://github.com/arlequins/beat/commit/787f8b251e51a0d2afabb7898afc99855a1e4f68))
* **web:** validate locale navigation ([9236bcd](https://github.com/arlequins/beat/commit/9236bcdaf7b40e7c232cfbff99e51d5bcfebd26b))

## [1.1.2] - 2026-07-23

### Changed

- Updated the template release metadata to v1.1.2.

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
