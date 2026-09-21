# ChatGPT MCP import for Gourmet

Beat's OAuth-protected MCP server connects Gourmet directly to a ChatGPT
conversation. ChatGPT supplies the meal text and can pass conversation
attachments as file inputs. Beat downloads each temporary file, normalizes it,
and attaches the resulting WebP to the matching Gourmet draft. The MCP server
cannot read a user's account history or search other conversations.

## Production endpoints and OAuth

Set the non-secret production variable `BEAT_MCP_RESOURCE` to the exact resource
URL, normally `https://<beat-api-origin>/mcp`. Beat publishes protected-resource
metadata at `https://<beat-api-origin>/.well-known/oauth-protected-resource/mcp`.
The root `/.well-known/oauth-protected-resource` alias remains available to
clients that do not implement path-aware lookup. The metadata points to
`BEAT_AUTH_ISSUER_URL`, whose discovery document advertises Authorization Code
+ PKCE, token, revocation, and end-session endpoints.

Add a dedicated public OAuth client to `BEAT_AUTH_CLIENTS_JSON`, using the exact
callback URI shown by ChatGPT's connector setup:

```json
{
  "client_id": "chatgpt-gourmet",
  "redirect_uris": ["https://chatgpt.com/connector/oauth/<callback_id>"],
  "post_logout_redirect_uris": ["https://chatgpt.com/connector/oauth/<callback_id>"],
  "resources": ["https://<beat-api-origin>/mcp"],
  "scopes": ["openid", "profile", "email", "offline_access", "gourmet:read", "gourmet:write"]
}
```

Replace placeholders with the exact values from the connector registration
screen. Beat rejects URI variations, unknown resource indicators, unsupported
scopes, and PKCE methods other than S256. Never add a wildcard or broad ChatGPT
origin. If ChatGPT uses a Client ID Metadata Document, allowlist its exact
`https://chatgpt.com/oauth/.../client.json` URL as `client_id` instead of
`chatgpt-gourmet`.

The issuer, signing key, and Google credentials remain in the protected runtime
Secrets Manager JSON. `BEAT_MCP_RESOURCE` and the public client allowlist are
ordinary deployment configuration. No separate Gourmet Action credential is
required.

## Tools and review boundary

| Tool | Scope | Effect |
| --- | --- | --- |
| `gourmet_get_context` | `gourmet:read` | Reads recent published records to help detect duplicates and preferences |
| `gourmet_preview_import` | `gourmet:read` | Validates and previews meal candidates without writing |
| `gourmet_confirm_import` | `gourmet:write` | Saves confirmed candidates as drafts and attaches any supplied photos |

ChatGPT should preview the complete meal details first. It may call the write
tool only after the user asks to save or import them. The tool always saves
`source: "chatgpt"` and `status: "draft"`; it never publishes. Administrators
continue to review and publish records in Beat `/admin/`.

ChatGPT file input follows the [Apps SDK file input reference](https://developers.openai.com/ko-KR/plugins/reference)
for `_meta["openai/fileParams"]`. The tool declares a top-level `images` file
field; each item contains the
provided `download_url` and `file_id`, with optional `mime_type` and `file_name`.
The MCP server verifies the HTTPS URL and each redirect against the trusted
OpenAI file host, caps source downloads, decodes supported JPEG/PNG/WebP files,
applies orientation, resizes the long edge to 1,600 pixels, converts to WebP,
strips image metadata, and keeps the result below 700 KiB. It does not log file
URLs, IDs, names, image bytes, or meal text.

At most six photos can be passed in one call. For one meal, all photos map to
that meal by default. For multiple meals, `imageEntryIndexes` is required and
maps each photo to an `entries` item by its zero-based position. The list must
have one valid meal index per photo. Ambiguous mappings are rejected before any
record is created.

All photos are downloaded and optimized before any meal draft is created. If a
later S3 write fails, the request can leave a draft with only some of its
photos. Repeating the same import uses stable meal idempotency and content-hash
image keys, so it fills missing media without adding duplicate drafts or
images. The administrator can also remove or rearrange images using existing
Gourmet controls.

## ChatGPT setup and current availability

1. Open ChatGPT on the web and add the public HTTPS MCP server URL.
2. Complete OAuth and confirm ChatGPT discovers all three Gourmet tools.
3. In a conversation with a meal photo attached, ask for a draft. Confirm that
   the preview includes the meal, then authorize saving it.
4. Check `/admin/` for the draft and confirm its photo is present before
   publishing it.
5. Check that a token with `gourmet:read` but without `gourmet:write` receives a
   scope error from `gourmet_confirm_import`.

[OpenAI's current MCP availability guidance](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt)
says full MCP write support is rolling out to Business, Enterprise, and Edu
plans; Pro supports read/fetch only. This is a platform availability statement,
not a determination of the account or connector used for a particular Beat
setup. MCP apps are currently web-only.
The current Codex task has no Beat MCP connector tools, so it cannot verify the
user's production ChatGPT connector or upload a real conversation photo. Verify
that path in ChatGPT itself after deployment.

ChatGPT keeps a snapshot of approved tool definitions. After adding the
`images` file parameter, refresh the connector's tools/actions in ChatGPT and
approve the updated definition. Business apps may need to be recreated and
republished after publishing changes; Enterprise/Edu admins can refresh tool
actions from workspace app settings.

For repeatable public-boundary verification, run the protected `Production MCP
smoke` workflow from `main` with the deployed API origin, exact resource URL,
and the `production` confirmation. It checks protected-resource metadata, OIDC
discovery, MCP initialization, and the unauthenticated challenge. It does not
mint a user token or create Gourmet records; the first real preview and write
must be checked through ChatGPT and the admin screen.
