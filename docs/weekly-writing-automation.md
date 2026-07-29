# Weekly writing pull-request automation

The weekly IT brief remains a Korean-first draft, but it must never be pushed
directly to `main`. The scheduled writer opens a pull request, GitHub requests
Arlequin's review, and GitHub Mobile is the approval surface.

## Required automation contract

Update the existing weekly-writing automation to run every Monday morning in
Korea Standard Time and use a dedicated GitHub App or bot account. Its token
needs only repository contents write and pull-request write permissions.

For one run on `2026-08-03`, the automation must:

1. Start from the latest `main` and create
   `automation/weekly-it-brief-2026-08-03`.
2. Add exactly one Korean MDX post under `apps/web/content/posts/` and its
   English and Japanese records in `apps/web/src/lib/localized-content.ts`.
3. Set `reviewStatus: unreviewed`, include source links, and retain the
   writer's date and judgment in the article.
4. Run `pnpm content:check` and
   `pnpm turbo run build --filter=@acme/web...`.
5. Commit only those content files, push the branch, and create a PR into
   `main` with a title such as `content: weekly IT brief — 2026-08-03`.
6. Stop when a validation step fails. It must not fall back to a direct push
   into `main`.

GitHub's [`CODEOWNERS`](../.github/CODEOWNERS) then requests Arlequin's review.
The **Content integrity** check confirms frontmatter and translation coverage;
the normal **Static portfolio** check confirms the published pages build.

## One-time repository configuration

After the bot has successfully created one test PR, protect `main` with:

- one required approving review;
- dismissal of stale approvals after a push;
- required checks: **Format**, **Static portfolio**, and **Content integrity**;
- resolved conversations before merge.

Do not enable required approvals before the bot is the PR author. A human
author cannot supply their own independent approval.

## Mobile confirmation

On GitHub Mobile, open the review request and check the source links, date,
claim boundaries, Korean draft status, and English/Japanese summaries. Choose
**Approve** only after the article is fit to publish. Change `reviewStatus` to
`reviewed` in the same approved PR or in a small follow-up PR.
