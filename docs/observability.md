# Observability

The template combines structured JSON logs, CloudWatch Embedded Metric Format,
and optional OpenTelemetry export.

## OpenTelemetry export

Set `OTEL_EXPORTER_OTLP_ENDPOINT` to the base URL of an OTLP/HTTP collector. The
API sends traces to `/v1/traces` and metrics to `/v1/metrics`. With no endpoint,
the SDK remains disabled and local development has no collector dependency.

| Variable | Purpose |
| --- | --- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP/HTTP collector base URL |
| `OTEL_EXPORTER_OTLP_HEADERS` | Comma-separated, percent-encoded `key=value` headers |
| `OTEL_SERVICE_NAME` | Resource service name; defaults to `api` |
| `OTEL_SERVICE_VERSION` | Optional deployed version |

Use a collector as the stable application endpoint and configure the collector
to forward data to the chosen backend. Store authorization headers in the
deployment secret store, never in committed environment files.

The API starts instrumentation before importing Hono, database, and router
modules. Application spans use `Telemetry.trace`; request counters and duration
histograms are emitted through both OpenTelemetry and CloudWatch EMF.

## Local collector

Any OTLP/HTTP-compatible collector listening on port `4318` can be used locally:

```dotenv
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=api
```

Unset the endpoint to return to the dependency-free local mode.

## GitHub Actions failure issues

The `CI failure issue` workflow listens for failures in CI, Security, GitHub
Pages, and the production availability monitor. It keeps one open issue per
workflow and adds later failed run links as comments, so mobile GitHub
notifications remain useful without creating an issue for every retry. Issues
contain only the workflow, commit SHA, and public Actions URL; runtime secrets
and AWS credentials are never included.
# Production availability monitor

The `Production availability monitor` workflow runs hourly and can also be
started manually. It assumes the protected production deployment role through
GitHub OIDC, reads only the public `apiUrl` SST output into a temporary runner
file, verifies HTTPS, and checks the GitHub Pages website and API health
endpoint.

It never reads the runtime secret. A failure creates one open GitHub issue with
a link to the failed run; the issue is not duplicated while it remains open.

## Batch failure alerts

The shared Step Functions failure path publishes a small, allowlisted summary to
`ALERT_TOPIC_ARN` after retries are exhausted. The batch Lambda receives only
`sns:Publish` on that exact topic ARN; it does not log the original Step
Functions input because that input may contain content or credentials.

Configure the topic ARN in the protected production environment and subscribe
the topic to the operator's preferred channel (email, incident tooling, or an
HTTPS endpoint). Leaving the variable unset keeps the failure path operational
but emits a clear disabled-alert warning, which is appropriate for local and
qualification runs.
