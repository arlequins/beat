# Beat Gourmet records

Beat Gourmet is a personal meal log. ChatGPT's OAuth-protected MCP connection can
send conversation text and attached photos together to a new `draft`. Beat never
publishes an imported record automatically. An administrator reviews the draft
and chooses whether to publish it. Public pages expose only `published` records.
See the [ChatGPT MCP setup guide](gourmet-chatgpt-mcp.md) and the
[end-to-end integration guide](gourmet-integration-flow.md).

## Storage and photos

| Data | System of record | Reason |
| --- | --- | --- |
| Current meal record | Versioned Beat state bucket | Low-volume JSON updates with ETag conflict detection |
| Record history and audit | Object Lock ledger bucket | Append-only operational evidence |
| Optimized meal image | Versioned Beat state bucket (`v1/gourmet/images/`) | Private image storage served through the API |

The MCP photo flow downloads ChatGPT's temporary file URL over HTTPS, restricts
the host and every redirect, caps source bytes, and decodes only supported image
formats. It applies EXIF orientation, resizes to a maximum 1,600-pixel long
edge, converts to WebP, strips metadata, and keeps each stored image below
700 KiB. It optimizes every image before creating any records. The API then
validates the optimized bytes again before storing them under a content-hash
key. The existing administrator upload flow continues to normalize photos in
the browser and uses the same private S3 storage boundary.

Public pages never read the bucket directly. The image API checks that an entry
is published before streaming its image. Administrators can preview draft
images through an authenticated, non-cacheable route. Removing an image from a
record removes its metadata from the active revision; S3 object versioning and
the deployment role's lack of `s3:DeleteObject` preserve the recoverable object.

## API and authorization

Public requests can list and read only published records:

```text
GET /api/gourmet/entries
GET /api/gourmet/entries/{id-or-slug}
GET /api/gourmet/images/{entryId}/{imageId}
```

The MCP connection uses OAuth and separate `gourmet:read` and `gourmet:write`
scopes. Read tools can inspect recent published records and preview extracted
meal candidates. The write tool creates `source: "chatgpt"`, `status: "draft"`
records and attaches any supplied images. It cannot publish, archive, edit, or
use administrator image operations. The existing Beat access JWT remains the
only way to review, edit, publish, archive, or manage photos in `/admin/`.

Create requests use a stable idempotency key. Repeating the same import does
not create another meal. S3 image IDs are derived from the entry ID and image
bytes, so a retry after a partial image attach reuses the existing image rather
than creating a duplicate. If a storage failure happens after a draft is saved,
the draft can remain without all of its photos; retrying the same import fills
in missing photos without duplicating the record or already attached images.

Ratings are from 0 through 10 in 0.5 increments. Text arrays accept at most 24
trimmed values; unknown request properties are rejected. Images are limited to
six files per tool call, 12 MiB per source file and 30 MiB total source bytes.
The optimized WebP must fit below 700 KiB, leaving room under the storage API's
768 KiB limit.

## Static route model

The public index is `/gourmet/` (and `/en/gourmet/`, `/ja/gourmet/`). The page
is a statically exported client shell that reads current records from the API.
Because new S3 records do not exist at Next.js build time, details use the
page-preserving URL `/gourmet/?entry={slug}` instead of a route that could not
be pre-rendered.

## Production configuration

Set the non-secret `BEAT_MCP_RESOURCE` deployment variable to
`https://<beat-api-origin>/mcp`, then add ChatGPT's exact OAuth callback URI,
that resource URL, and the `gourmet:read` / `gourmet:write` scopes to
`BEAT_AUTH_CLIENTS_JSON`. Keep signing material and Google credentials only in
the protected runtime secret. There is no Gourmet Action API key or Action
endpoint. Follow the [MCP setup guide](gourmet-chatgpt-mcp.md) before enabling
the connector.

The same runtime secret contains the GitHub App values used for article
publication. Its installation needs repository `Contents: read/write` and
`Pull requests: read/write`. Keep public API/site URLs on production origins
and set `API_CORS_ORIGINS` to the exact portfolio origin.
