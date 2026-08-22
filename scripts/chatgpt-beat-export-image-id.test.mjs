import assert from "node:assert/strict";
import { test } from "node:test";

const { imageIdFor } = await import(
  new URL("../tools/chatgpt-beat-export/image-id.js", import.meta.url)
);

test("image IDs match the API content-hash boundary", async () => {
  const first = await imageIdFor("entry-1", "aGVsbG8=");
  const repeated = await imageIdFor("entry-1", "aGVsbG8=");
  const differentEntry = await imageIdFor("entry-2", "aGVsbG8=");

  assert.equal(first, "e20c535931056d0d");
  assert.equal(repeated, first);
  assert.notEqual(differentEntry, first);
});
