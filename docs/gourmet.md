# Beat Gourmet records

Beat Gourmet is a production-oriented personal meal log. A Custom GPT can save
structured text after the user confirms it, while the public portfolio renders
only `published` records. Administrators use the existing Beat login to edit,
publish, archive, and attach photographs.

For the request-by-request connection between ChatGPT, Beat authentication, S3,
the administrator browser, and the public site, see the
[end-to-end integration guide](gourmet-integration-flow.md).

## Storage decision

The two data classes deliberately use different systems of record:

| Data | System of record | Reason |
| --- | --- | --- |
| Current meal record | Versioned Beat state bucket | Low-volume JSON updates with ETag conflict detection |
| Record history and audit | Object Lock ledger bucket | Append-only operational evidence |
| Optimized meal image | Versioned Beat state bucket (`v1/gourmet/images/`) | The private API streams published images with immutable cache headers |

Images are stored in the private state bucket, not in the GitHub repository or
the ledger bucket. In the administrator browser, the selected file is
orientation-corrected, resized to at most 1,600 pixels on its long edge,
converted to WebP, and compressed below 768 KiB. The canvas conversion discards
EXIF metadata, including embedded location data.

The API independently validates the declared type, magic bytes, extension, and
size before writing the object under a content-hash key. Public pages never
read the bucket directly: `/api/gourmet/images/:entryId/:imageId` verifies that
the entry is published, reads the object, and streams it with cache headers.
This keeps the bucket private while avoiding a growing image history in GitHub.

## API and authorization

Public requests can list and read only published records:

```text
GET /api/gourmet/entries
GET /api/gourmet/entries/{id-or-slug}
GET /api/gourmet/images/{entryId}/{imageId}
```

The separate `BEAT_GOURMET_ACTION_API_KEY` Bearer credential can create and
update records and request recent context. It is not a Beat administrator JWT,
cannot archive records, and cannot upload images.

```text
POST  /api/gourmet/entries
PATCH /api/gourmet/entries/{id-or-slug}
GET   /api/gourmet/context
```

The existing Beat access JWT can call all record APIs. Only that administrator
principal can archive records or attach an image to the private state bucket:

```text
DELETE /api/gourmet/entries/{id-or-slug}
POST   /admin/gourmet/entries/{id-or-slug}/images
GET    /admin/gourmet/entries/{id-or-slug}/images/{image-id}
DELETE /admin/gourmet/entries/{id-or-slug}/images/{image-id}
```

The administrator image GET route is authenticated and non-cacheable, so the
admin screen can preview draft images without making them public. The image
delete endpoint removes the image metadata from the current record
revision. It intentionally does not delete the private S3 object: bucket
versioning and the deployment role's lack of `s3:DeleteObject` preserve a
recoverable original. After the metadata is removed, the public image route
returns `404` even if an older object version still exists.

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
3. Attach a phone photo and confirm it is stored in the private state bucket.
4. Open the public record and confirm the API image URL returns the WebP with
   cache headers; the original EXIF payload is not present.
5. Return to `/admin/`, select the published record, preview the image, and
   use `사진 분리` if the metadata should no longer be shown. Confirm the
   record revision changes and the public image URL returns `404`; do not
   expect the retained S3 object to be deleted.
6. Configure the Custom GPT Action using
   [`gourmet-action.openapi.yaml`](gourmet-action.openapi.yaml), then run the
   create and context operations in Preview.
