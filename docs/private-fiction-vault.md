# Private fiction vault

The private long-form fiction outline is not a public Beat episode. Keep its
source outside `apps/web/content`, public assets, and catalog metadata. The
`/private-fiction/` is a standalone top-level page. It ships only an empty
reader shell, fetches the manuscript after login from the authenticated API,
and is marked as non-indexable.

The API verifies the signed Beat access token and permits the account bound to
Beat's configured Google administrator identity. The signed `sub` is the
stable Beat account ID; the configured administrator email is checked as a
second binding. The browser never supplies an account identifier to authorize
itself. Other accounts receive a not-found response, and unauthenticated
requests receive an unauthorized response.

The API stores one document at the fixed S3 key
`author-vault/reality-error/outline.md` in a dedicated private bucket. The
bucket has versioning, server-side encryption, enforced TLS, ownership controls,
and S3 Block Public Access. The Lambda role can read or write only that object;
it has no delete permission. Conditional ETag writes prevent overwriting a
newer copy. HTTP responses and the S3 object use `private, no-store` cache
controls. Authenticated Markdown uploads are limited to 4,000,000 UTF-8 bytes,
which accommodates the current multi-episode manuscript in one synchronous API
request. The content is never exposed through a public S3 URL.

The current deployment remains GitHub Actions/OIDC-only. Provision the bucket
through the protected production workflow before using the page. Upload the
outline from the authenticated page; do not add it to Git, a release artifact,
or the static site build.
