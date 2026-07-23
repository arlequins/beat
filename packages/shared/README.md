# `@acme/shared`

Small **cross-cutting** helpers used by multiple packages. Keep **domain logic** in feature packages (`@acme/db-backbone`, apps, …); add only reusable utilities here.

## Exports

| Subpath             | Contents                                                                                                                                                          |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@acme/shared`      | Re-exports (see [`src/index.ts`](./src/index.ts))                                                                                                                 |
| `@acme/shared/seed` | [`runDrizzleSeeds`](./src/seed.ts) — discover and run ordered seeds and record their names                                                                         |
| `@acme/shared/seed-safety` | Pure helpers that guard example data outside local and test environments                                                                                  |

### `runDrizzleSeeds` (summary)

Used by `@acme/db-backbone`’s `scripts/seed.ts`. Pass `{ scriptDir, db }` (and optionally `ledger` for schema/table names). Loads root `.env` via the caller’s `with-env` so `resolveDeployStage()` and DB URLs behave like the rest of the repo.
