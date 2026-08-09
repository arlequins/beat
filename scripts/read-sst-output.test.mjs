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

  it("rejects missing or ambiguous outputs", () => {
    assert.throws(() => readSstOutput("{}", "apiUrl"), /exactly one/);
    assert.throws(
      () => readSstOutput('{"apiUrl":"a","nested":{"apiUrl":"b"}}', "apiUrl"),
      /exactly one/,
    );
  });
});
