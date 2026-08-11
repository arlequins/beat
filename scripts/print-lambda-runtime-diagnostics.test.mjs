import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatRuntimeDiagnosticEvents,
  redactRuntimeDiagnostic,
} from "./print-lambda-runtime-diagnostics.mjs";

describe("Lambda runtime diagnostics", () => {
  it("redacts private keys, labelled secrets, and bearer tokens", () => {
    const message = [
      "BEAT_AUTH_LOOKUP_SECRET=secret-value",
      "authorization: Bearer a-very-long-access-token-value",
      "-----BEGIN PRIVATE KEY-----\\nprivate-value\\n-----END PRIVATE KEY-----",
    ].join(" ");

    const result = redactRuntimeDiagnostic(message);

    assert.doesNotMatch(
      result,
      /secret-value|private-value|access-token-value/,
    );
    assert.match(result, /BEAT_AUTH_LOOKUP_SECRET=\[REDACTED\]/);
    assert.match(result, /authorization: \[REDACTED\]/);
    assert.match(result, /\[REDACTED PRIVATE KEY\]/);
  });

  it("formats only CloudWatch event messages", () => {
    const result = formatRuntimeDiagnosticEvents(
      {
        events: [
          {
            message: "Error: Beat runtime secret is missing GITHUB_APP_ID",
            timestamp: Date.parse("2026-08-11T01:15:00.000Z"),
          },
        ],
        nextToken: "never printed",
      },
      "/aws/lambda/api-production-Example",
    );

    assert.deepEqual(result, [
      "/aws/lambda/api-production-Example 2026-08-11T01:15:00.000Z Error: Beat runtime secret is missing GITHUB_APP_ID",
    ]);
  });

  it("reports an empty filtered result without failing", () => {
    assert.deepEqual(
      formatRuntimeDiagnosticEvents({}, "/aws/lambda/api-production-Example"),
      ["/aws/lambda/api-production-Example: no matching log events"],
    );
  });
});
