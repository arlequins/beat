# Test Operations

## Test Layers

For file naming, mocking, and test design rules, see the
[Testing Policy](conventions/testing.md).

- Unit and contract tests run on every pull request.
- Migration upgrade tests apply the original schema and then migrate to the current schema in an isolated PostgreSQL container.
- Testcontainers creates a fresh PostgreSQL instance for repository integration tests, applies every Drizzle migration, and removes the instance after the suite.
- Playwright runs the OIDC flow and accessibility checks on desktop and mobile Chromium.
- The production API deployment runs a smoke test against the exact
  `BEAT_PRODUCTION_API_URL`. The same check can be run manually through the
  Production smoke workflow. Beat has no scheduled sandbox environment.
- k6 baseline load tests are manual, require the protected production
  environment, and require the `production` confirmation input.

Create a protected `production` GitHub Environment and configure
`BEAT_PRODUCTION_API_URL` as its exact public HTTPS API origin. The API
deployment runs the smoke check after SST finishes; the manual workflow accepts
the same origin as an explicit input.

```bash
gh api --method PUT repos/OWNER/REPOSITORY/environments/production
gh variable set BEAT_PRODUCTION_API_URL --env production --body "https://api.example.com"
gh workflow run aws-smoke.yml -f api_url="https://api.example.com"
```

Do not run the load-test workflow until capacity, cost, rollback, and incident
ownership have been approved. It deliberately uses the same protected
production environment rather than creating a second cloud stage.

## Flaky-test Policy

A failed test is a failure until understood. Retry is diagnostic, not a pass condition. Fix deterministic race, clock, data, and selector issues first. A temporarily quarantined test must have an issue, owner, expiry date, and separate non-blocking job. Do not add arbitrary sleeps; wait on observable state. Track retry rate and remove quarantine before the expiry date.
