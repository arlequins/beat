import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../tools/chatgpt-beat-export/", import.meta.url);

test("ChatGPT exporter is a private MV3 extension without embedded secrets", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("manifest.json", root), "utf8"),
  );
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting", "tabs"]);
  assert.ok(manifest.host_permissions.includes("https://chatgpt.com/*"));
  assert.ok(
    manifest.host_permissions.some((value) => value.includes("lambda-url")),
  );
  const sources = await Promise.all(
    [
      "background.js",
      "content-chatgpt.js",
      "content-beat-admin.js",
      "popup.js",
    ].map((name) => readFile(new URL(name, root), "utf8")),
  );
  const source = sources.join("\n");
  assert.doesNotMatch(source, /BEAT_GOURMET_ACTION_API_KEY|refreshToken/);
  assert.match(source, /beat-admin-session/);
  assert.match(source, /contentBase64/);
});
