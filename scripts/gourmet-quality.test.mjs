import assert from "node:assert/strict";
import test from "node:test";

import {
  auditPublicGourmetEntries,
  fetchGourmetQuality,
} from "./gourmet-quality.mjs";

test("reports missing dates and photos without mutating entries", () => {
  const entries = [
    { id: "one", restaurantName: "白銀屋", menuName: "さば", images: [] },
  ];
  const report = auditPublicGourmetEntries(entries);
  assert.equal(report.errorCount, 0);
  assert.equal(report.warningCount, 2);
  assert.equal(entries[0].images.length, 0);
});

test("reports unknown metadata as an error only for names", () => {
  const report = auditPublicGourmetEntries([
    {
      id: "two",
      restaurantName: "미상",
      menuName: "미상",
      visitedAt: "2026-08-22",
      images: [{ altText: "미상", originalFilename: "unknown.webp" }],
    },
  ]);
  assert.equal(report.errorCount, 2);
  assert.equal(report.warningCount, 1);
});

test("fetches only the public gourmet list over HTTPS", async () => {
  let requested;
  const report = await fetchGourmetQuality(
    "https://api.example.com",
    async (url) => {
      requested = String(url);
      return Response.json({
        entries: [
          {
            id: "one",
            restaurantName: "店",
            menuName: "定食",
            visitedAt: "2026-08-22",
            images: [{ altText: "店 定食", originalFilename: "meal.webp" }],
          },
        ],
      });
    },
  );
  assert.match(requested, /\/api\/gourmet\/entries\?page=1&pageSize=100$/);
  assert.deepEqual(report.issues, []);
});
