# Fiction guide and production handoff engineering notes

This note records the decisions from the September 22 fiction-guide and
production handoff work. It is intended to keep future content releases from
reintroducing a fixed episode ceiling or breaking the protected Agent
configuration when a new approved OAuth client is added.

## Keep the fiction guide open-ended

The fiction guide is an index for a continuing work. Text such as “the novel's
twenty episodes” or `1~20편` reads like a product limit once later episodes
exist. Use open wording in public guide copy:

- “초기 회차는 독립적인 단편을 중심으로 이어진다.”
- “이후 회차부터는 다섯 편이 하나의 사건을 이루는 연작으로 넓어진다.”
- “소설 전체를 관통하는 길”

Episode numbers remain valid when they identify a concrete handoff in the
story. A continuity table may therefore mention episode 20 as the place where
the next scene begins, but that reference must not be used as the guide's
scope or headline. The canonical public locations are:

- `apps/web/src/components/blog/fiction-guide-pages.tsx`
- `apps/web/content/fiction-guide/world.md`
- `apps/web/content/fiction-guide/omnibus.md`

When adding a new arc, update the current-reading table and the continuation
record, then search the guide for fixed-count wording before opening the PR:

```bash
rg -n -i '소설 스무 편|스무 편|1~20편|20페이지|20페이지만' \
  apps/web/content/fiction-guide \
  apps/web/src/components/blog/fiction-guide-pages.tsx
```

## Preserve the prose review boundary

Episodes 21~40 were reviewed against the earlier short-story section. The
useful review unit was not a plot summary; it was the cause-and-effect chain a
reader needs inside each scene. The revised prose makes the following visible
before the next decision:

- where the water route, sluice, or embankment is and why it is dangerous;
- why three beams are required, what is sacrificed during the rescue, and how
  the remaining beams reach the village;
- how the bell signal, key, grain ledger, and testimony fit together;
- how the port construction changes the water level and why inside and outside
  readings must be compared.

Keep physical traces as evidence of what an object experienced, not as an
automatic proof of safety or guilt. The fiction guide's continuation record
should describe this review as the “earlier short-story section” rather than
hard-coding a count as the permanent style boundary.

## Production handoff: approved callback extension

`BEAT_AUTH_CLIENTS_JSON` is an environment value, not a secret, and the
`beat-agent-web` registration can contain both the Agent callback and the
approved ChatGPT connector callback:

```text
https://arlequins.github.io/beat-agent/auth/callback/
https://chatgpt.com/connector/oauth/O8bneWii3GuT
```

The validator in `scripts/validate-production-handoff.mjs` must enforce all of
the following:

1. The Agent callback is present and exact.
2. Every additional callback belongs to the explicit approved allowlist.
3. The logout callback remains exactly the Agent logout callback.
4. The required OIDC scopes remain `openid`, `profile`, `email`, and
   `offline_access`.
5. CORS contains the Pages origin and the Agent origin, and never `*`.

Do not change this to “any HTTPS callback” or restore the old array-length-one
check. Add a regression test for each newly approved callback and one test that
rejects an unapproved callback. The validator checks identifiers and URLs only;
runtime secrets are validated by the separate protected workflow step.

## Release and diagnosis order

Content and infrastructure have separate release gates:

1. Feature PR CI and security checks.
2. Merge to `main`.
3. GitHub Pages build and public URL check for static content.
4. Release Please PR, tag, and GitHub Release.
5. Production infrastructure diff and protected deployment when the API or
   batch application changes.

A failure at `Validate Beat and Agent production handoff` means the protected
environment configuration and the validator disagree. Inspect the current
environment variables and the exact commit under test; do not infer the cause
from a Pages build result. The successful fix for the ChatGPT callback was
recorded in PR #255 and verified by the subsequent production diff and
deployment runs.

Useful checks are:

```bash
node --test scripts/validate-production-handoff.test.mjs
pnpm content:check
gh pr checks <number> --watch --interval 20
gh run view <run-id> --json status,conclusion,jobs,url
```

Historical failed workflow runs remain in GitHub. The acceptance signal is the
latest run for the exact `main` commit: all required checks, Pages deployment,
and (when applicable) the protected production diff/deployment must be green.
