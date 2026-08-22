# Feature-sliced migration map

Beat uses two complementary boundaries:

- **Clean Architecture on the server**: domain models and application ports are
  independent from Hono, AWS SDKs, S3, and environment loading. HTTP adapters
  translate requests and composition roots select the concrete adapters.
- **Feature-Sliced Design in the web app**: route files stay in `app/`; reusable
  cross-cutting code belongs in `shared/`, business entities in `entities/`,
  user actions in `features/`, and composed screens in `widgets/`.

## Dependency direction

```text
Web app route -> widget -> feature -> entity -> shared
HTTP adapter -> application port <- S3/GitHub adapter
                 └─ domain model
```

The direction is enforced by `pnpm architecture:check`. Compatibility barrels
at the former flat paths are intentionally temporary migration seams; new code
must import from the feature slice.

## Current slices

| Area | Slice | Boundary |
| --- | --- | --- |
| API | `features/content` | MDX drafts, revisions, publication jobs, and GitHub-backed persistence |
| API | `features/gourmet` | meal domain, S3 repository, application port, and HTTP adapter |
| Web | `features/beat-handoff` | Beat Agent context handoff and consent UI |
| Web | `entities/gourmet` | Gourmet API vocabulary, image URLs, date formatting, and timeline model |
| Web | `entities/content` | studio health and recent-record projections |
| Web | `widgets/gourmet-browser` | public Gourmet browsing screen |
| Web | `widgets/admin-studio` | admin studio overview widget |

## Migration rules

1. Add domain types and invariants before moving persistence code.
2. Put external effects behind an application port; implement the port in
   `infrastructure/` and wire it in `composition.ts`.
3. Keep route handlers thin: parse, authorize, call a port, and map errors.
4. Keep `app/` route modules free of business state; compose widgets there.
5. Keep compatibility barrels until all imports migrate, then remove them in a
   separate cleanup change.
6. Add a focused unit test at the domain/application boundary before adding an
   adapter integration test.

This is an incremental migration. Authentication, publication reconciliation,
and MCP delivery still have flat compatibility entry points and are the next
candidate slices. No production behavior or AWS resource boundary changes are
part of this refactor. Remove each compatibility barrel only after its import
search is empty and the corresponding boundary test has moved to the slice.
