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
Access. The Lambda role can read and write only this object and cannot delete
it. HTTP and S3 responses use private, no-store cache controls. The reader API
still requires the configured Beat owner account.

The API accepts at most 4,000,000 UTF-8 bytes, enough for the current
multi-episode reading edition. To synchronize an update, commit that reading
edition to the private manuscript repository's main branch. GitHub Actions
will upload it and verify the S3 readback. The workflow can be manually
rerun from GitHub Actions when needed. Refresh the private reader on the
device to load the saved version.

## Security boundary

The private repository and its workflow logs must remain private. Protect the
main branch so only trusted changes can modify the trusted workflow and source.
The API intentionally trusts only the named repository, main branch, and
specific workflow path; moving or renaming that workflow requires changing the
API trust rule in the same reviewed release.
