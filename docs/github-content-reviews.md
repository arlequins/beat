# GitHub-native mobile content review

Portfolio writing is reviewed with GitHub, not an external chat or mail
service. When a pull request changes a path in
[`../.github/CODEOWNERS`](../.github/CODEOWNERS), GitHub automatically requests
review from Arlequin. The GitHub Mobile app can send a push notification for
that review request; open the pull request, inspect the article and its source
links, then submit **Approve** or **Request changes**.

The GitHub pull request is the single record of review, comments, approval, CI
results, and merge. No webhook URL, mail provider, or third-party secret is
needed.

## Review flow

1. A weekly-writing automation or contributor opens a pull request instead of
   pushing a new MDX file straight to `main`.
2. A change under `apps/web/content/`, `apps/web/public/gourmet/`, or `docs/`
   triggers the code-owner review request for `@arlequins`.
3. GitHub Mobile notifies the reviewer. Check the article's sources, date,
   judgment, and `reviewStatus`; use **Request changes** for revisions or
   **Approve** after the mobile check.
4. After approval and passing CI, merge the PR. If the article is final, change
   `reviewStatus` from `unreviewed` to `reviewed` in that approved PR or a
   follow-up PR.

The scheduled writer's branch, validation, and bot-permission contract is in
[weekly writing pull-request automation](weekly-writing-automation.md).

## Required repository setting

After automated content PRs are created by a separate GitHub App or Actions
bot, protect `main` with these settings:

- require one approving pull request review;
- dismiss stale approvals when new commits are pushed;
- require the `Format` and `Static portfolio` checks to pass;
- require conversation resolution before merging.

Do not require an approval while you are the only human account creating the
PRs: GitHub does not treat an author's own review as an independent approval.
Until content is opened by a bot identity, CODEOWNERS still provides ownership
and a clear review destination, but the required-review rule should remain off.

## Mobile setup

Install GitHub Mobile, sign in as `@arlequins`, and enable notifications for
**review requests**. GitHub Mobile then becomes the push channel; GitHub PRs
remain the confirmation surface.
