import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../tools/chatgpt-beat-export/", import.meta.url);

const matcher = await import(new URL("matcher.js", root));

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
      "matcher.js",
      "image-id.js",
      "popup.js",
    ].map((name) => readFile(new URL(name, root), "utf8")),
  );
  const popup = await readFile(new URL("popup.html", root), "utf8");
  const source = sources.join("\n");
  assert.doesNotMatch(source, /BEAT_GOURMET_ACTION_API_KEY|refreshToken/);
  assert.match(source, /beat-admin-session/);
  assert.match(source, /contentBase64/);
  assert.match(source, /X-Client-Request-Id/);
  assert.match(source, /crypto\.randomUUID/);
  assert.match(source, /CHECK_ADMIN_SESSION/);
  assert.match(source, /visibleImageCount/);
  assert.match(source, /imageIdFor/);
  assert.match(source, /already connected|이미 연결/);
  assert.match(source, /data-image/);
  assert.match(popup, /확인한 사진을 초안에 연결/);
});

test("matches Korean meal text deterministically and groups assignments", () => {
  const entries = [
    {
      id: "b",
      menuName: "냉면",
      rating: 7,
      restaurantName: "을지면옥",
      summary: "담백한 육수",
      tasteNotes: ["슴슴함"],
    },
    {
      id: "a",
      menuName: "돈카츠",
      rating: 8,
      restaurantName: "다른 식당",
      summary: "바삭한 식감",
      tasteNotes: [],
    },
  ];
  const ranked = matcher.rankEntries(
    entries,
    "오늘 을지면옥 냉면은 7점, 슴슴함",
  );
  assert.equal(ranked[0].entry.id, "b");
  assert.deepEqual(
    matcher.buildAssignments([
      { entryId: "b", images: [{ id: "1", selected: false }] },
      { entryId: "b", images: [{ id: "2" }] },
      { entryId: "a", images: [{ id: "3" }] },
    ]),
    [
      { entryId: "b", images: [{ id: "2" }] },
      { entryId: "a", images: [{ id: "3" }] },
    ],
  );
  assert.deepEqual(
    matcher.buildAssignments([
      { entryId: "b", images: [{ id: "skip", selected: false }] },
    ]),
    [],
  );
});
