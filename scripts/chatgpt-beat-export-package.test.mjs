import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const manifestUrl = new URL(
  "../tools/chatgpt-beat-export/manifest.json",
  import.meta.url,
);
const packageScriptUrl = new URL(
  "./package-chatgpt-beat-export.mjs",
  import.meta.url,
);

test("ChatGPT exporter packaging is versioned and credential-free", async () => {
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
  const script = await readFile(packageScriptUrl, "utf8");
  assert.equal(manifest.manifest_version, 3);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.match(script, /beat-gourmet-chatgpt-export-v\$\{version\}\.zip/);
  assert.match(script, /createHash\("sha256"\)/);
  assert.match(script, /BEAT_GOURMET_ACTION_API_KEY/);
  assert.doesNotMatch(script, /GITHUB_TOKEN|BEAT_GITHUB_APP_PRIVATE_KEY/);
});
