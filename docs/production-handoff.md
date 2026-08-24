# Production handoff status

This page is the current checklist for the Beat portfolio, Beat API, and Beat
Agent. It records public contracts and configuration blockers without storing
runtime secrets or AWS credentials.

## Current public contract

| Surface | Contract |
| --- | --- |
| Portfolio | `https://arlequins.github.io/beat/` |
| Beat Agent | `https://arlequins.github.io/beat-agent/` |
| Agent API | `https://p3akjheufygfnr54k7vhz6kria0inkun.lambda-url.ap-northeast-1.on.aws/` |
| Beat OIDC issuer for Agent | `https://4kfwvp7y2qoprape5p2jr5qvra0ekgcl.lambda-url.ap-northeast-1.on.aws/auth` |
| OIDC clients | `beat-agent-web`, `beat-admin-web` |
| Access-token audience | `beat-agent` |
| JWT algorithm | `ES256` |

The portfolio opens the Agent in a new window. It never forwards an access
token, refresh token, workspace identifier, or conversation data.

The protected Beat production Environment carries the exact public callback
registrations for the Pages-hosted Agent and portfolio administrator:

```text
https://arlequins.github.io/beat-agent/auth/callback/
https://arlequins.github.io/beat-agent/auth/logout-callback/
https://arlequins.github.io/beat/admin/callback/
https://arlequins.github.io/beat/admin/
```

The portfolio's `/admin/` page uses Google SSO through `beat-admin-web` and
does not display or submit an email/password form. The existing protected
administrator operation still uses a one-time password only to bootstrap or
rotate the S3 administrator record; it is not a browser login method.

The API CORS allowlist contains the browser origin
`https://arlequins.github.io`; paths such as `/beat/` and `/beat-agent/` are not
included in an origin value.

The hourly protected monitor also checks the public Agent entry. Set the
production Environment variable `BEAT_AGENT_WEB_URL` only when the Agent moves
to another public URL; otherwise it defaults to
`https://arlequins.github.io/beat-agent/`. This is a public URL, not a secret.

## Five-step completion state

1. **Agent OIDC and chat:** Beat discovery, Authorization Code + PKCE S256,
   exact callback allowlists, refresh/revoke, and end-session contracts are
   implemented. The Agent Pages contract smoke has passed.
2. **Operations:** Beat has protected API diff/deploy, redacted runtime
   diagnostics, hourly public availability monitoring, SNS alarm routing, and
   a GitHub issue path for monitor failures.
3. **Template baseline:** reusable operations from template-t3-turbo-sst v1.2.0
   are represented in Beat's workflows and runbooks; Beat-specific S3/OIDC
   boundaries remain application-owned.
4. **Content and SEO:** the multilingual content checker, localized data,
   static locale routes, canonical metadata, hreflang links, and Gourmet
   review boundary are retained. New content must update its localized data.
5. **Version and operations contract:** Beat release automation uses the
   `beat-vX.Y.Z` tag, while the Agent uses `vX.Y.Z`; the integration contract
   remains documented in `docs/beat-agent-auth-integration.md`.

## Current acceptance state

There is no known protected-configuration blocker in the Beat-to-Agent identity
path. Beat Agent `v0.11.2` is the current release. Its Pages app, callback, and
API returned HTTP 200 during the 2026-08-22 handoff review; the protected
production deployment, Google SSO smoke, and recurring production contract
smoke are green.

Beat still treats model-provider readiness as an Agent-owned check. No Bedrock
model identifier, AWS credential, Google secret, or test-account token belongs
in this repository, a static bundle, or this document. Local development does
not require those production values.

## Safe verification order

1. Run the Agent production contract smoke and Google SSO smoke.
2. Run Beat's protected production availability monitor. If application
   infrastructure changed, review the exact main SHA diff before deploy.
3. Confirm the Pages build, administrator Google login, and Beat new-window
   chat entry from the public portfolio.
4. Create one Gourmet draft through the confirmed ChatGPT/MCP flow, publish it
   in the administrator workspace, and verify the public list.
5. Preserve the workflow URLs and release tags as acceptance evidence.

No local AWS, SST diff, SST deploy, or secret inspection is part of this flow.
