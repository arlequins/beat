# Weekly writing pull-request automation

The weekly IT brief remains a Korean-first draft, but it must never be pushed
directly to `main`. The scheduled writer opens a pull request, GitHub requests
Arlequin's review, and GitHub Mobile is the approval surface.

## Required automation contract

The existing weekly-writing automation runs every Monday morning in Korea
Standard Time and opens a PR rather than publishing it. Use a dedicated GitHub
App or bot account when required approvals will be enforced; its token needs
only repository contents write and pull-request write permissions. Until then,
the automation's existing GitHub identity may open the draft PR, but it cannot
serve as an independent approval.

For each weekly run, the automation must:

1. Start from the latest `main` and create
   `automation/weekly-it-brief-YYYY-MM-DD`.
2. Add exactly one Korean MDX post under `apps/web/content/posts/` and its
   English and Japanese records in `apps/web/src/lib/localized-content.ts`.
3. Set `reviewStatus: unreviewed`, include source links, and retain the
   writer's date and judgment in the article.
4. Run `pnpm content:check` and
   `pnpm turbo run build --filter=@arlequins/web...`.
5. Commit only those content files, push the branch, and create a PR into
   `main` with a title such as `content: weekly IT brief — 2026-08-03`.
6. Stop when a validation step fails. It must not fall back to a direct push
   into `main`.

## One current automated draft

Before opening a new draft, inspect open pull requests to `main`. Only a
bot-authored branch matching `automation/weekly-it-brief-YYYY-MM-DD` may be
treated as a weekly automation draft. If it is older than the current run,
close it without merging and explain that the newer weekly draft supersedes it.
Never close human-authored PRs or unrelated automation PRs.

The result is intentionally simple: at most one open weekly draft, always the
most recent one. A same-date draft remains the source of truth and must not be
duplicated.

GitHub's [`CODEOWNERS`](../.github/CODEOWNERS) then requests Arlequin's review.
The **Content integrity** check confirms frontmatter and translation coverage;
the normal **Static portfolio** check confirms the published pages build.

## One-time repository configuration

After the bot has successfully created one test PR, protect `main` with:

- zero required approvals while Arlequin is the only human collaborator, or one
  independent approval once a human collaborator joins;
- dismissal of stale approvals after a push;
- required checks: **Format**, **Static portfolio**, and **Content integrity**;
- resolved conversations before merge.

The bot may create or update its draft PR, but it never counts as an
independent reviewer. Review from GitHub Mobile remains the normal human
confirmation surface even when the solo-repository approval count is zero.

## Mobile confirmation

On GitHub Mobile, open the review request and check the source links, date,
claim boundaries, Korean draft status, and English/Japanese summaries. Choose
**Approve** only after the article is fit to publish. Change `reviewStatus` to
`reviewed` in the same approved PR or in a small follow-up PR.
