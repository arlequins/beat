import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readSstOutput } from "./read-sst-output.mjs";

describe("SST output reader", () => {
  it("reads one nested deployment output without printing the state", () => {
    const state = JSON.stringify({
      resources: [{ outputs: { apiUrl: "https://example.lambda-url.aws/" } }],
    });
    assert.equal(
      readSstOutput(state, "apiUrl"),
      "https://example.lambda-url.aws/",
    );
  });

  it("ignores pnpm banners and trailing command output around the state", () => {
    const source = `
> @acme/api@ with-env /workspace/apps/api
> dotenv -- sst state export --stage production

{
  "resources": [{"outputs":{"apiUrl":"https://example.lambda-url.aws/"}}]
}
SST telemetry disabled
`;
    assert.equal(
      readSstOutput(source, "apiUrl"),
      "https://example.lambda-url.aws/",
    );
  });

  it("rejects missing or ambiguous outputs", () => {
    assert.throws(() => readSstOutput("{}", "apiUrl"), /exactly one/);
    assert.throws(
      () => readSstOutput('{"apiUrl":"a","nested":{"apiUrl":"b"}}', "apiUrl"),
      /exactly one/,
    );
  });

  it("does not expose invalid state contents in parse errors", () => {
    const sensitive = "not-json-runtime-secret";
    assert.throws(
      () => readSstOutput(sensitive, "apiUrl"),
      (error) =>
        error instanceof Error &&
        /Unable to parse SST state JSON/.test(error.message) &&
        !error.message.includes(sensitive),
    );
  });
});
