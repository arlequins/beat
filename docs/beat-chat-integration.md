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

## Local check

Run Beat locally, then build or run the portfolio with a different port and the
destination set, for example:

```bash
# Beat application repository
pnpm dev:local

# Portfolio repository
NEXT_PUBLIC_BEAT_APP_URL=http://localhost:3000 pnpm --filter @acme/web dev -- --port 3001
```

Open the portfolio at `http://localhost:3001`, choose **Beat과 대화하기**, and
confirm that Beat opens in a new tab, performs its own login if needed, and
keeps citations and feedback inside that application.
