# Dependency and Release Automation

## Renovate

Install the Renovate GitHub App for the repository. The checked-in
`.github/renovate.json` then provides weekly updates, immediate vulnerability
alerts, bounded PR concurrency, and compatibility groups for the major runtime
stacks. Patch and stable minor updates may merge only after all required CI
checks pass. Major updates always require review.

Keep `main` protected and require CI and Security checks before enabling
Renovate automerge. The Dependency Dashboard is the operational view for
blocked, pending, and manually approved updates.

## Release Please

Release Please reads Conventional Commits on `main` and maintains one release
PR for the Beat application. The repository package is named `beat`; the
template initializer's internal `template-t3-turbo-sst` token remains only as
the source identity that gets replaced when generating a new application. The
PR updates `package.json`,
`.release-please-manifest.json`, and `CHANGELOG.md`. Merging it creates a
`beat-vX.Y.Z` tag and a GitHub Release.

Create a fine-grained token that can read repository contents and write
contents and pull requests, then store it as `RELEASE_PLEASE_TOKEN`. A GitHub
App installation token is preferable for organizations that already manage a
release automation app. Do not use a personal broad-scope classic token.

```bash
gh secret set RELEASE_PLEASE_TOKEN
gh workflow run release.yml
```

The separate token is intentional: pull requests opened with the workflow's
default `GITHUB_TOKEN` do not trigger another workflow run, which would prevent
the release PR from receiving the required CI checks.

Release PRs follow the same review and branch-protection requirements as other
changes. Do not manually edit the generated version or changelog unless the
release PR is being corrected deliberately.
