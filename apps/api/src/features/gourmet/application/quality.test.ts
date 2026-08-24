import { describe, expect, it } from "vitest";

import type { GourmetEntry } from "../domain/models";
import { auditGourmetEntries } from "./quality";

function entry(overrides: Partial<GourmetEntry> = {}): GourmetEntry {
  return {
    area: null,
    cookingMethods: [],
    createdAt: "2026-08-22T00:00:00.000Z",
    cuisineTags: [],
    discoveries: [],
    externalRequestId: null,
    freeTextNote: null,
    id: "entry-1",
    images: [],
    ingredients: [],
    liked: [],
    menuName: "定食",
    nutritionTags: [],
    postMealNotes: [],
    rating: 7,
    restaurantBranch: null,
    restaurantName: "店",
    revisit: "unknown",
    schemaVersion: 1,
    slug: "entry-1",
    source: "manual",
    status: "published",
    summary: "맛있는 식사",
    tasteNotes: [],
    updatedAt: "2026-08-22T00:00:00.000Z",
    visitedAt: "2026-08-22",
    revision: 1,
    ...overrides,
  };
}

describe("auditGourmetEntries", () => {
  it("reports missing photos as a warning", () => {
    const result = auditGourmetEntries([entry()]);
    expect(result).toMatchObject({
      totalEntries: 1,
      errorCount: 0,
      warningCount: 1,
    });
    expect(result.issues[0]).toMatchObject({
      code: "missing-image",
      severity: "warning",
    });
  });

  it("reports unknown names and image metadata", () => {
    const result = auditGourmetEntries([
      entry({
        menuName: "미상",
        restaurantName: "미상",
        visitedAt: null,
        images: [
          {
            altText: "미상",
            byteSize: 1,
            createdAt: "2026-08-22T00:00:00.000Z",
            height: null,
            id: "image-1",
            mimeType: "image/webp",
            originalFilename: "unknown.webp",
            publicPath: "/api/gourmet/images/entry-1/image-1",
            sortOrder: 0,
            storageKey: "v1/gourmet/images/entry-1/image-1.webp",
            width: null,
          },
        ],
      }),
    ]);
    expect(result.errorCount).toBe(2);
    expect(result.warningCount).toBe(2);
  });

  it("returns a clean report for a complete draft", () => {
    const result = auditGourmetEntries([
      entry({
        status: "draft",
        images: [
          {
            altText: "店 定食",
            byteSize: 10,
            createdAt: "2026-08-22T00:00:00.000Z",
            height: null,
            id: "image-1",
            mimeType: "image/webp",
            originalFilename: "meal.webp",
            publicPath: "/api/gourmet/images/entry-1/image-1",
            sortOrder: 0,
            storageKey: "v1/gourmet/images/entry-1/image-1.webp",
            width: null,
          },
        ],
      }),
    ]);
    expect(result.issues).toEqual([]);
  });

  it("flags active draft and published duplicates for cleanup", () => {
    const result = auditGourmetEntries([
      entry({ id: "draft", status: "draft" }),
      entry({ id: "published", status: "published" }),
      entry({ id: "archived", status: "deleted" }),
    ]);
    expect(
      result.issues.filter((issue) => issue.code === "duplicate-record"),
    ).toHaveLength(2);
  });
});
