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
| OIDC client | `beat-agent-web` |
| Access-token audience | `beat-agent` |
| JWT algorithm | `ES256` |

The portfolio opens the Agent in a new window. It never forwards an access
token, refresh token, workspace identifier, or conversation data.

The protected Beat production Environment carries the exact public callback
registration for the Pages-hosted Agent:

```text
https://arlequins.github.io/beat-agent/auth/callback/
https://arlequins.github.io/beat-agent/auth/logout-callback/
```

The API CORS allowlist contains the browser origin
`https://arlequins.github.io`; paths such as `/beat/` and `/beat-agent/` are not
included in an origin value.

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

## Blockers requiring protected configuration

The Agent production deployment run failed before SST could change resources
because its protected `DEPLOYMENT_ENV_FILE` did not contain both approved Nova
Lite identifiers:

```dotenv
BEDROCK_MODEL_ID=amazon.nova-lite-v1:0
BEDROCK_MODEL_ARN=arn:aws:bedrock:ap-northeast-1::foundation-model/amazon.nova-lite-v1:0
```

The Beat Agent Google SSO smoke also timed out because Beat's Google SSO runtime
configuration is not currently available to the protected smoke path. Neither
value belongs in Git, a static bundle, or this document. After the protected
Environment is corrected, rerun the Agent production API deployment and then
the Google SSO smoke from GitHub Actions.

The local application does not require Bedrock or Google credentials. Local
development uses the development OIDC mock and MinIO/PostgreSQL boundaries.

## Safe verification order

1. Configure the Agent production `DEPLOYMENT_ENV_FILE` and Beat Google SSO
   runtime secret through protected repository settings.
2. Run the Agent production API deployment through GitHub Actions/OIDC.
3. Run the Agent production contract smoke and Google SSO smoke.
4. Run Beat's protected production diff, deploy, and availability monitor.
5. Confirm the Pages build and the Beat new-window chat entry from the public
   portfolio.

No local AWS, SST diff, SST deploy, or secret inspection is part of this flow.
