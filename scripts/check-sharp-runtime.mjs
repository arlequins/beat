#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Security-fixed native baselines shipped by Sharp 0.35.5. Keep this independent
// of the pin so a manifest/lockfile downgrade cannot lower the check with it.
const minimumVersions = {
  sharp: "0.35.5",
  vips: "8.18.7",
  heif: "1.23.2",
  rsvg: "2.63.2",
};

function atLeast(version, minimum) {
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version))
    return false;
  const actual = version.split(".").map(Number);
  const expected = minimum.split(".").map(Number);
  for (let index = 0; index < expected.length; index += 1) {
    if (actual[index] !== expected[index])
      return actual[index] > expected[index];
  }
  return true;
}

export function assertPatchedSharp(
  versions,
  name,
  requireBundledCodecs = false,
) {
  for (const [library, minimum] of Object.entries(minimumVersions)) {
    const required =
      library === "sharp" || library === "vips" || requireBundledCodecs;
    if (!required && versions[library] === undefined) continue;
    assert.ok(
      atLeast(versions[library], minimum),
      `${name}: ${library} must be >=${minimum}; found ${versions[library] ?? "missing"}`,
    );
  }
}

function checkRuntime() {
  const apiManifestUrl = new URL("../apps/api/package.json", import.meta.url);
  const apiManifest = JSON.parse(readFileSync(apiManifestUrl, "utf8"));
  const apiRequire = createRequire(apiManifestUrl);
  const apiSharp = apiRequire("sharp");
  const webRequire = createRequire(
    new URL("../apps/web/package.json", import.meta.url),
  );
  const nextRequire = createRequire(webRequire.resolve("next/package.json"));
  const nextSharp = nextRequire("sharp");
  // Linux x64/arm64 is the production-like native packaging path. Other
  // platforms may omit codecs, but any codec present must still be patched.
  const requireBundledCodecs =
    process.platform === "linux" && ["x64", "arm64"].includes(process.arch);
  assertPatchedSharp(apiSharp.versions, "API", requireBundledCodecs);
  assertPatchedSharp(nextSharp.versions, "Next", requireBundledCodecs);
  assert.equal(
    apiSharp.versions.sharp,
    apiManifest.dependencies.sharp,
    "The API deployment pin must match the installed Sharp runtime",
  );
  assert.equal(
    nextSharp.versions.sharp,
    apiSharp.versions.sharp,
    "Next and the API must resolve the same patched Sharp runtime",
  );
  console.log(
    "API and Next resolve the pinned security-fixed Sharp native runtime.",
  );
  console.log(
    JSON.stringify(
      Object.fromEntries(
        Object.keys(minimumVersions).map((key) => [
          key,
          apiSharp.versions[key],
        ]),
      ),
    ),
  );
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
)
  checkRuntime();
