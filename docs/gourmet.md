# Beat Gourmet records

Beat Gourmet is a production-oriented personal meal log. A Custom GPT can save
structured text after the user confirms it, while the public portfolio renders
only `published` records. Administrators use the existing Beat login to edit,
publish, archive, and attach reviewed photographs.

For the request-by-request connection between ChatGPT, Beat authentication, S3,
the administrator browser, GitHub image PRs, and the public site, see the
[end-to-end integration guide](gourmet-integration-flow.md).

## Storage decision

The two data classes deliberately use different systems of record:

| Data | System of record | Reason |
| --- | --- | --- |
| Current meal record | Versioned Beat state bucket | Low-volume JSON updates with ETag conflict detection |
| Record history and audit | Object Lock ledger bucket | Append-only operational evidence |
| Optimized meal image | `apps/web/public/gourmet/` in GitHub | A reviewable PR publishes the asset with the static site |

Images are not stored in the state or ledger bucket. In the administrator
browser, the selected file is orientation-corrected, resized to at most 1,600
pixels on its long edge, converted to WebP, and compressed below 768 KiB. The
canvas conversion discards EXIF metadata, including embedded location data.
The API independently validates the declared type, magic bytes, extension, and
size before a GitHub App creates a dedicated image branch and pull request.

Merging that PR places the image in the static export and triggers the normal
GitHub Actions deployment. Until the image PR is merged, its URL can be absent
from the currently deployed site. This is an intentional review boundary.

Repository storage is suitable here because this is a personal, low-volume
archive of already-compressed assets. It should be reconsidered if images grow
quickly, originals must be retained, uploads exceed GitHub's Contents API
limits, or repository clone/build performance becomes material. Do not commit
raw phone photographs or use Git LFS for assets expected to be copied directly
by the current static build.

## API and authorization

Public requests can list and read only published records:

```text
GET /api/gourmet/entries
GET /api/gourmet/entries/{id-or-slug}
```

The separate `BEAT_GOURMET_ACTION_API_KEY` Bearer credential can create and
update records and request recent context. It is not a Beat administrator JWT,
cannot archive records, and cannot create image pull requests.

```text
POST  /api/gourmet/entries
PATCH /api/gourmet/entries/{id-or-slug}
GET   /api/gourmet/context
```

The existing Beat access JWT can call all record APIs. Only that administrator
principal can archive records or attach a repository image:

```text
DELETE /api/gourmet/entries/{id-or-slug}
POST   /admin/gourmet/entries/{id-or-slug}/images
```

Create requests accept `Idempotency-Key`. Repeating an identical payload with
the same key returns the same record; reusing it for a different payload returns
`409 Conflict`. Updates accept `expectedRevision` and also return `409` when a
different administrator saved first. Delete is a soft delete and remains in S3
history.

Ratings are from 0 through 10 in 0.5 increments. Arrays accept at most 24
trimmed values; unknown request properties are rejected.

## Static route model

The public index is `/gourmet/` (and `/en/gourmet/`, `/ja/gourmet/`). The page
is a statically exported client shell that reads current records from the API.
Because new S3 records do not exist at Next.js build time, details use the
page-preserving URL `/gourmet/?entry={slug}` instead of pretending that an
unknown `/gourmet/{slug}` route can be pre-rendered.

## Production configuration

Add a random value of at least 32 characters to the API runtime JSON secret:

```json
{
  "BEAT_GOURMET_ACTION_API_KEY": "replace-with-a-long-random-value"
}
```

The same secret already contains the GitHub App values used by article
publication. Its installation needs repository `Contents: read/write` and
`Pull requests: read/write`. Keep `NEXT_PUBLIC_API_URL` and
`NEXT_PUBLIC_SITE_URL` on the production origins and set `API_CORS_ORIGINS` to
the exact portfolio origin. The Action credential is server-only and must never
use the `NEXT_PUBLIC_` prefix.

No AWS resource is deployed by this implementation. The existing state and
ledger buckets are reused after the production stack is deployed.

## Operator checks

1. Log in at `/admin/` and create a draft Gourmet record.
2. Publish it, then confirm it appears at `/gourmet/`.
3. Attach a phone photo and inspect the generated GitHub pull request.
4. Confirm the committed file is WebP and contains no original EXIF payload.
5. Merge the image PR and wait for the static deployment check.
6. Configure the Custom GPT Action using
   [`gourmet-action.openapi.yaml`](gourmet-action.openapi.yaml), then run the
   create and context operations in Preview.
