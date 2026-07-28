# Mobile content review notifications

When a pull request changes a portfolio MDX post or a file under `docs/`, the
**Content review notification** workflow posts a review link to Slack. Open the
link in Slack or the GitHub mobile app, review the rendered post and sources,
then submit **Approve** or **Request changes** in GitHub. GitHub's review is the
approval record; Slack is the prompt and deep link.

## Why Slack first

The Slack Free plan supports channels, personalized notifications, and up to
three app integrations. A single incoming webhook is enough for this workflow,
so a small personal portfolio does not need a paid Slack plan just to receive
review prompts. Free Slack retains 90 days of searchable messages; use a paid
plan only if longer searchable history or broader integration capacity matters.

Email is not inherently paid: you can send through an existing mailbox or SMTP
provider. Reliable transactional sending still requires sender-domain setup,
deliverability monitoring, and often a provider plan as volume grows. For this
single-reviewer workflow, Slack is the smaller operational commitment.

## Setup

1. Create a private Slack channel, such as `#portfolio-review`.
2. Create an incoming webhook for that channel in Slack and copy its webhook
   URL. Treat it as a secret: anyone holding it can post to the channel.
3. In GitHub, add it as the repository Actions secret `SLACK_WEBHOOK_URL`.
4. Enable notifications for the channel on your phone and sign in to the GitHub
   mobile app with an account that can review this repository.
5. Open or update a pull request that changes `apps/web/content/**/*.mdx` or
   `docs/**` to send a test notification.

The workflow intentionally sends nothing until the secret is configured. It
never puts the webhook URL, a mail address, or an access token in the repository
or PR output.

## Approval boundary

Slack messages do not merge or publish anything. They only open the pull
request. Enable branch protection requiring a pull request review if a GitHub
approval must block merging. A new commit dismisses a stale approval when that
repository rule is enabled, so each meaningful revision receives a fresh mobile
check.
