import assert from "node:assert/strict";
import test from "node:test";
import { assertPatchedSharp } from "./check-sharp-runtime.mjs";

const patched = {
  sharp: "0.35.5",
  vips: "8.18.7",
  heif: "1.23.2",
  rsvg: "2.63.2",
};

test("accepts the patched native runtime and later stable releases", () => {
  assert.doesNotThrow(() => assertPatchedSharp(patched, "fixture", true));
  assert.doesNotThrow(() =>
    assertPatchedSharp(
      { ...patched, sharp: "0.36.0", vips: "9.0.0" },
      "fixture",
      true,
    ),
  );
});

test("rejects vulnerable Sharp and native libraries independently", () => {
  for (const [library, version] of Object.entries({
    sharp: "0.34.5",
    vips: "8.17.3",
    heif: "1.20.2",
    rsvg: "2.61.2",
  })) {
    assert.throws(
      () =>
        assertPatchedSharp({ ...patched, [library]: version }, "fixture", true),
      new RegExp(library),
    );
  }
});

test("requires core runtime versions and bundled Linux codecs", () => {
  for (const library of Object.keys(patched)) {
    const versions = { ...patched };
    delete versions[library];
    assert.throws(
      () => assertPatchedSharp(versions, "fixture", true),
      new RegExp(library),
    );
  }
  assert.doesNotThrow(() =>
    assertPatchedSharp({ sharp: "0.35.5", vips: "8.18.7" }, "optional codecs"),
  );
  assert.throws(() => assertPatchedSharp({}, "missing runtime"), /sharp/);
});

test("does not accept malformed or prerelease version strings", () => {
  for (const sharp of ["0.35.5-rc.1", "0.35", "invalid", undefined])
    assert.throws(
      () => assertPatchedSharp({ ...patched, sharp }, "fixture"),
      /sharp/,
    );
});
