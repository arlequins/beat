# Production API runtime diagnostics

Use the protected **Production API runtime diagnostics** GitHub Actions
workflow after a deployed API returns a Lambda or Function URL 5xx response.
It is deliberately an incident-read path, not an AWS CLI procedure for local
machines.

## Runbook

1. Open the failed **Production deployment** workflow run and copy its numeric
   run ID.
2. From `main`, dispatch **Production API runtime diagnostics**.
3. Enter that run ID and confirm `production` in the protected GitHub
   Environment.
4. Review the redacted initialization events. The workflow limits the window
   to five minutes before through twenty minutes after the cited deployment.
5. Apply the smallest application fix supported by the exception, run a new
   production infrastructure diff for its exact `main` commit, and deploy only
   after the diff is reviewed.

The workflow assumes the production role through GitHub OIDC. It discovers
only `/aws/lambda/api-production-*` log groups and reads filtered events for
the selected interval. It does not invoke Lambda, change infrastructure,
download Secrets Manager values, write SST state, or upload log artifacts.

Before output, the formatter removes private-key PEM blocks, labelled secret
values, and bearer tokens. It keeps only timestamped event messages necessary
to identify an initialization failure.

## Least-privilege role handoff

The Beat production deployment role already has `logs:DescribeLogGroups`. The
`beat-sst-aws` owner must additionally grant this exact read-only statement to
that existing role before the workflow can read event data. Do not add broad
CloudWatch, Secrets Manager, or administrator permissions.

```json
{
  "Sid": "ReadBeatProductionLambdaDiagnostics",
  "Effect": "Allow",
  "Action": ["logs:FilterLogEvents"],
  "Resource": "arn:aws:logs:ap-northeast-1:AWS_ACCOUNT_ID:log-group:/aws/lambda/api-production-*:*"
}
```

This is a baseline-owned IAM change; it belongs in `beat-sst-aws`, not this
application repository. Once that change is deployed, use the workflow with
the failed production deployment run ID. For the current incident, that ID is
recorded in the GitHub Actions link supplied with the incident report, not in
this repository.
