# Private fiction vault

The private fiction reader is served at /private/fictions/ and fetches its
manuscript only after the owner authenticates. The reader shell is part of the
public web build; the manuscript is not.

The source of record belongs in the author's private manuscript repository.
That repository's GitHub Actions workflow sends the fixed reading edition to
Beat's private-fiction sync endpoint. The manuscript is never copied into this
public Beat repository, its Pages build, release artifacts, or public catalog.

## Authentication and data flow

The sync workflow runs on pushes to the configured source file on the private
repository's main branch and can also be started manually from its Actions
page. It requests a short-lived GitHub OIDC token with the dedicated audience
beat-private-fiction-sync. No AWS credential, Beat password, long-lived API
token, or repository variable is stored for this integration.

The API verifies the OIDC signature using GitHub's published keys and checks
the issuer, audience, private repository visibility, exact repository name,
main branch, workflow path, and event type. It rejects any other identity
before accessing storage. The workflow has only contents: read and id-token:
write permissions, uses a GitHub-hosted runner, and prints neither the source
nor the token to its logs.

The endpoint is POST /admin/private-fiction/github-sync. It reads the current
S3 ETag, writes conditionally, and reads the object back. The response includes
the readback SHA-256 and byte count; the workflow compares both with the source
it sent. An identical source is treated as a no-op, and conflicting writes
fail rather than silently overwriting a newer version.

The manuscript stays in a dedicated private S3 bucket at
author-vault/reality-error/outline.md. The bucket has versioning,
server-side encryption, enforced TLS, ownership controls, and S3 Block Public
Access. The API Lambda role can read and write only this outline and the
separate annotation object; it cannot list the bucket or delete either object.
HTTP and S3 responses use private, no-store cache controls. The reader API
still requires the configured Beat owner account.

The API accepts at most 4,000,000 UTF-8 bytes, enough for the current
multi-episode reading edition. To synchronize an update, commit that reading
edition to the private manuscript repository's main branch. GitHub Actions
will upload it and verify the S3 readback. The workflow can be manually
rerun from GitHub Actions when needed. Refresh the private reader on the
device to load the saved version.

## Reading titles, progress and passage feedback

The reader and contents use `1화. 아크 제목 - 1`: the first number is the
episode and the last is its position in the arc. A cover heading before
`<!-- PAGE_BREAK -->` starts an arc; subsequent bare episode headings inherit
that arc. Legacy numbered episode titles remain supported. Location headings
in the body do not restart an arc.

The library, episode list and reading settings offer `읽은 기록 전부 리셋하기`.
After confirmation it clears this device's public and private reading positions
and last-read pointers. It preserves authentication, cached manuscripts, reading
preferences and server feedback. It does not reset another device's history.

Readers can drag text or long-press it on mobile to leave an anchored comment.
After adjusting the selection, choose `선택한 부분에 리뷰 남기기` to open the
comment box; it does not obscure the text while selection handles are moving.
The feedback menu also offers an explicit passage-selection mode. Selection
disables page-turn gestures. Selections may cross paragraphs, up to 2,000
characters; all paragraph anchors are saved together with the same comment using
the existing owner-only annotation endpoint and its conditional-write ETag.
Highlights are restored from that document when the reader is reopened.
Anchors from the same save operation are shown as one review and deleted together.

With the restricted S3 role, a missing annotation object can be reported as 403
instead of 404 ([AWS GetObject documentation](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html)).
The repository initializes it using a conditional empty write (`If-None-Match: *`).
An existing or concurrently created document is read back, never overwritten.
Denied writes or unreadable existing documents remain storage errors; they are
never silently reported as an empty feedback list. Bucket-list permissions are unchanged.

## Security boundary

The private repository and its workflow logs must remain private. Protect the
main branch so only trusted changes can modify the trusted workflow and source.
The API intentionally trusts only the named repository, main branch, and
specific workflow path; moving or renaming that workflow requires changing the
API trust rule in the same reviewed release.
