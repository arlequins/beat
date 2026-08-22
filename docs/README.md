# Documentation

Use this page as the entry point for project documentation. The root
[README](../README.md) covers installation and the shortest path to a running
local application; the pages below explain design decisions and ongoing work.

## Start Here

1. [Application architecture](architecture.md) explains workspace boundaries
   and the browser-to-database request flow.
2. [Feature-sliced migration map](architecture-migration.md) explains the
   server and web slice boundaries.
3. [Developer experience](developer-experience.md) covers generators, fast
   feedback commands, and template qualification.
3. [Template readiness](template-readiness.md) lists the capabilities to retain
   or deliberately remove when adapting the template.
4. [Generic application baseline](generic-application.md) explains the reusable
   CRUD, authorization, upload, and Clean Architecture example.
5. [Portfolio content](portfolio-content.md) explains how to replace the
   starter identity, projects, and technical writing.
6. [GitHub-native mobile content review](github-content-reviews.md) explains
   code-owner review requests and approval from GitHub Mobile.
7. [Weekly writing pull-request automation](weekly-writing-automation.md)
   defines the bot-authored review and publishing flow.
8. [Beat Gourmet records](gourmet.md) explains the S3 record model, repository
   image review, public browser, and administrator workflow.
9. [Custom GPT setup for Gourmet](gourmet-custom-gpt.md) covers the Action
   credential, schema, instructions, Preview checks, and photo boundary.
10. [Gourmet end-to-end integration](gourmet-integration-flow.md) traces the
    exact ChatGPT, Beat API, S3, administrator, GitHub PR, and public-site flow.
11. [ChatGPT MCP import for Gourmet](gourmet-chatgpt-mcp.md) documents the
    OAuth-protected, preview-first bridge from ChatGPT context to S3 drafts.
12. [ChatGPT Gourmet exporter](gourmet-chatgpt-export.md) documents the private
    one-click browser export for attaching conversation photos to Beat drafts.

## Development

- [OpenID Connect authentication](authentication.md): provider registration,
  local identity provider, token validation, and application authorization.
- [Database operations](database-operations.md): migration order, backups,
  restore verification, and failure recovery.
- [SST local testing](sst-local-testing.md): what can be validated without SST
  sign-in or AWS credentials.
- [Test operations](testing-operations.md): test layers, external test
  environments, and flaky-test policy.
- [Dependency and release automation](automation.md): Renovate policy,
  automated release PRs, tags, and changelog updates.
- [Observability](observability.md): structured logs, metrics, traces, and OTLP
  collector configuration.
- [UI development](ui-development.md): component tests, Storybook, and
  accessibility checks.
- [S3 cache](s3-cache.md): API and database caching, TTL, invalidation, and
  local configuration.
- [S3-primary production architecture](s3-primary-data-architecture.md):
  database-free identity, mutable state, immutable audit, and GitHub publishing
  on AWS.

## Deployment and Operations

- [GitHub Pages production frontend](github-pages-production.md): static web
  deployment, `/beat` path, CORS boundary, monitoring, and CloudFront retirement.
- [Vercel deployment](vercel-deployment.md): two-project Vercel deployment for
  the static web app and Hono API, with Neon PostgreSQL.
- [Deployment and supply-chain security](deployment-security.md): GitHub OIDC,
  protected environments, security checks, and response headers.
- [Production AWS/SST handoff](production-aws-sst.md): baseline ownership,
  secret boundary, least-privilege role handoff, protected diff/deploy, and
  rollback.
- [Incident runbook](incident-runbook.md): triage, mitigation, recovery, and
  observability integration points.
- [Production API runtime diagnostics](production-runtime-diagnostics.md):
  GitHub Actions-only, redacted CloudWatch initialization-failure triage.
- [Production handoff status](production-handoff.md): current Beat/Agent public
  contracts, completion checklist, and protected configuration blockers.
- [Semantic versioning](semantic-versioning.md): release impact and repository
  version policy.

## Engineering Conventions

- [Git, branches, commits, and releases](conventions/git.md)
- [Monorepo operations](conventions/monorepo.md)
- [Testing policy](conventions/testing.md)
- [tRPC router convention](conventions/trpc.md)
- [TypeScript, imports, exports, constants, and types](conventions/typescript.md)
- [AI collaboration convention](conventions/ai.md)

## AI Context

- [AI memory](ai-memory.md) is a compact repository map for coding agents. It
  supplements the engineering conventions and does not override them.

## Document Boundaries

- Put setup commands and the first successful local run in the root README.
- Put stable engineering rules under `docs/conventions/`.
- Put operational procedures in a dedicated top-level page under `docs/`.
- Update both the implementation and its canonical document in the same PR.
- Link to the canonical page instead of copying procedures into multiple files.
