# Git, Branches, Commits, and Releases

This convention applies to this repository and its workspaces.

## Branch Strategy

| Branch                                                        | Purpose                                                               |
| ------------------------------------------------------------- | --------------------------------------------------------------------- |
| `main`                                                        | The only production branch and source for protected deployments.      |
| `feature/<short-description>`                                 | Product changes branched from current `main` and merged through a PR. |
| `fix/<short-description>`                                     | Focused fixes branched from current `main` and merged through a PR.   |
| `automation/<short-description>`                              | Bot-created content or maintenance changes reviewed through a PR.    |
| `release-please--branches--main--components--beat`            | Release Please's managed version and changelog PR branch.             |

Prefer stacked PRs for large changes so each review stays small and focused.
The repository automatically deletes merged head branches. Never reuse a
deleted feature branch for later work.

## Merge Strategy

- Use squash merge for `feature/*`, `fix/*`, and `automation/*` into `main`.
  The PR title becomes the commit message, so it must follow
  [Conventional Commits](#commit-messages-conventional-commits-10).
- Merge the generated Release Please PR only after CI and Security pass. Do not
  create version tags locally.

## Commit Messages: Conventional Commits 1.0

Format:

```text
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

Allowed types:

| Type       | Use                                                         |
| ---------- | ----------------------------------------------------------- |
| `feat`     | New feature                                                 |
| `fix`      | Bug fix                                                     |
| `docs`     | Documentation-only changes, such as `README` or conventions |
| `refactor` | Internal changes that do not alter external behavior        |
| `perf`     | Performance improvements                                    |
| `test`     | Test additions or changes                                   |
| `chore`    | Dependency updates or tool configuration                    |
| `ci`       | CI configuration                                            |
| `build`    | Build or bundling configuration                             |
| `style`    | Formatting-only changes with no logic changes               |
| `revert`   | Reverts an existing commit                                  |

`scope` should name the changed package or area, such as `db`, `trpc`, `ui`, `tooling`, `web`, `api`, or `batch`. It is optional.

Subject rules:

- Use the imperative mood.
- Aim for 50 characters or fewer. `header-max-length` may allow up to 100 characters.
- Do not end with a period.
- Write subjects in English.

Use the optional body to explain background and intent. Wrap hard lines around 72 characters when practical.

Footer rules:

- Breaking changes: use `BREAKING CHANGE: <description>` in the footer, or add `!` to the subject, such as `feat!: ...`.
- Issue references: use `Refs: #123` or `Closes: #123`.

Examples:

```text
feat(validators): add Zod schema for batch creation

Add a shared validator around the insert schema so form submissions
and service entry points validate the same payload shape.

Closes: #42
```

```text
feat(trpc)!: change session shape in context

BREAKING CHANGE: ctx.session.token has been renamed to ctx.session.accessToken.
```

## Enforcement

| Layer                   | Mechanism                                                                   | Purpose                                     |
| ----------------------- | --------------------------------------------------------------------------- | ------------------------------------------- |
| Documentation           | This convention                                                             | Shared team understanding                   |
| Required PR checks      | GitHub branch protection with CI and Security                              | Prevent unverified production changes       |
| Release automation      | Release Please                                                            | Derive versions from conventional commits   |

Keep PR titles conventional even when GitHub does not provide a dedicated title
check, because Release Please calculates the next Beat version from the squash
commit on `main`.

## Release Procedure

See [semantic versioning](../semantic-versioning.md) for version calculation.

1. Merge Conventional Commits into `main`.
2. Review the Release Please PR containing the version and changelog update.
3. Merge the release PR after required checks and approvals pass.
4. Confirm that Release Please created the `beat-vX.Y.Z` tag and GitHub Release.

See [dependency and release automation](../automation.md) for repository setup.

## Hotfix Procedure

1. Create `fix/<short-description>` from current `origin/main`.
2. Add the smallest safe regression test and fix.
3. Open a PR and wait for CI and Security.
4. Squash merge, review the Release Please patch PR, and verify the protected
   deployment path. Never push a hotfix or tag directly to `main`.
