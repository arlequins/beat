# Incident Runbook

## Detection and Triage

CloudWatch alarms cover server errors, sustained average latency,
authentication failures, conditional-write conflicts, reconciliation failures,
publication backlog, and unexpected durable-state delete markers. The dashboard
includes requests, errors, latency, and Lambda cold starts. Set
`ALERT_TOPIC_ARN` to route alarms to an owned notification channel.

1. Acknowledge the alert and name an incident owner.
2. Check deployment events, stage, request IDs, error rate, latency, readiness, and external dependency status.
3. Use structured request and tRPC logs to follow a request ID. Tokens and secret-shaped fields are redacted.
4. Determine whether the incident is code, S3 state, Beat identity, GitHub, or
   another upstream dependency related.

## Mitigation

- Roll back only to a schema-compatible application release.
- Disable a failing optional readiness integration instead of bypassing required database readiness.
- For authentication incidents, do not weaken issuer, audience, expiry, or signature verification.
- For S3 incidents, preserve version IDs, CloudTrail events, Inventory reports,
  and the immutable ledger. Never remove Object Lock or delete noncurrent
  versions as mitigation.

## S3 and publication recovery

1. Stop administrator writes if conditional conflicts or delete markers are
   still increasing.
2. Locate the affected key and version in CloudTrail or S3 Inventory.
3. Dispatch `Production operations` with `recover-state-version` to copy the
   selected version into `v1/recovery/`. Do not copy it directly over a live
   head.
4. Inspect the quarantined JSON, schema version, digest, and related ledger
   events before a separate revision-checked promotion.
5. For content publication, inspect the S3 publication job and GitHub PR. The
   scheduled reconciler replays `pending` jobs and records `merged` or `closed`
   PR state. A persistent backlog requires operator investigation rather than
   repeated manual PR creation.
6. Confirm the CloudTrail log and deterministic `state-version-reconciled`
   ledger event exist for the affected version.

## Recovery and Follow-up

Verify liveness, readiness, a representative authenticated transaction,
reconciliation success, and alarm recovery. Record timeline, impact,
contributing conditions, actions, and owners. Add a regression test or alarm
adjustment before closing the incident.

## Integration Ports

`@arlequins/logger` exposes OpenTelemetry-backed `Telemetry` and a replaceable `ErrorReporter`. Projects can register an OpenTelemetry SDK/exporter at process startup and inject a vendor error reporter without changing API or domain code. With no SDK or reporter configured, tracing and reporting safely remain no-op while CloudWatch EMF metrics continue through stdout.
