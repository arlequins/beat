# Beat chat entry point

The portfolio is a static Next.js export. Its floating **Talk with Beat** entry
opens the separately hosted Beat application in a new tab. It is deliberately
not an iframe: Beat owns its own OIDC session, callback URL, conversation data,
citations, and feedback flow.

## Configure the public destination

Set this value in the portfolio web project's local environment and in its
hosting provider before building:

```dotenv
NEXT_PUBLIC_BEAT_APP_URL=http://localhost:3000
```

For production, replace the localhost value with the HTTPS origin of the Beat
web application. `NEXT_PUBLIC_*` values are embedded in the static JavaScript
bundle, so this value must be a public URL only. Do not put an API key, bearer
token, client secret, or private callback URL in this repository or variable.

When the variable is absent, the entry point is not rendered. This keeps a
static preview from linking visitors to a non-existent chat service.

## Why a new window

The portfolio makes no browser request to Beat's API and does not share an
authentication token. Opening Beat in a new window gives its OIDC provider a
single, exact application origin for redirect URIs and avoids third-party
cookie, frame-ancestor, and cross-origin storage failures that commonly affect
embedded authentication flows.

The entry describes the expected Beat experience — conversation, sources, and
feedback — but the portfolio does not collect or forward that data. Beat remains
the place where a signed-in user starts a conversation, sees citations, and
submits feedback.

## Beat application boundary

The current safe integration is a link only:

- Register OIDC redirect and logout callback URLs for the **Beat web origin**,
  not the portfolio origin.
- Keep Beat API access tokens, client secrets, database credentials, and
  retrieval sources inside the Beat application and API.
- Do not treat every public blog page as agent knowledge. Add portfolio content
  to Beat only through an explicit ingestion or public-document approval flow,
  with provenance preserved for citations.

If a later feature makes the browser call Beat's API directly, configure the
Beat API's CORS allowlist with the exact portfolio origin (scheme and host, no
trailing slash), use only an OIDC access token issued for the Beat API audience,
and keep the portfolio origin separate from Beat's own app origin. A CORS rule
does not replace OIDC validation or authorization.

## Administrator-only entry

An administrator-only Beat experience is possible, but it must not be enforced
by conditionally rendering a button in this static portfolio. Anyone can inspect
a static bundle or open a known Beat URL, so hiding the link is a convenience,
not an authorization boundary.

Use this model when the portfolio needs a private operator entry:

1. Give the portfolio an OIDC client with its own exact callback URL and use a
   server-side or edge authorization check to map the authenticated identity to
   an administrator allowlist.
2. Render the private entry only after that trusted check succeeds. The entry
   should still open Beat in a new window rather than pass a browser token,
   workspace ID, or conversation identifier through a URL.
3. Let Beat perform its independent OIDC login and enforce its existing
   workspace-owner/administrator policy for every chat, source, and feedback
   request. The portfolio login cannot substitute for Beat API authorization.
4. If embedding is required later, add an explicit Beat frame policy and test
   OIDC redirects, storage behaviour, logout, CSP `frame-ancestors`, and the
   exact production origins. Do not relax frame protections merely to make a
   local iframe work.

The current public entry remains a new-window link. It is safe for a public
portfolio because all data and authorization remain inside Beat. Add an
administrator portal only after the identity provider, deployed portfolio
origin, and exact administrator identities are configured.

## Local check

Run Beat locally, then build or run the portfolio with a different port and the
destination set, for example:

```bash
# Beat application repository
pnpm dev:local

# Portfolio repository
NEXT_PUBLIC_BEAT_APP_URL=http://localhost:3000 pnpm --filter @arlequins/web dev -- --port 3001
```

Open the portfolio at `http://localhost:3001`, choose **Beat과 대화하기**, and
confirm that Beat opens in a new tab, performs its own login if needed, and
keeps citations and feedback inside that application.
