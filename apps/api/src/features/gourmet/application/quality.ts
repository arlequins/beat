import type { GourmetEntry } from "../domain/models";

export type GourmetQualityIssue = {
  code:
    | "missing-image"
    | "missing-restaurant"
    | "missing-visited-at"
    | "unknown-image-metadata"
    | "unknown-menu";
  entryId: string;
  message: string;
  severity: "error" | "warning";
};

function isUnknown(value: string | null | undefined) {
  return !value?.trim() || value.trim().toLocaleLowerCase() === "미상";
}

/**
 * A deliberately conservative, human-review quality report. It never edits
 * records and treats missing photos as warnings so an otherwise valid meal
 * record can still be published while its image is being prepared.
 */
export function auditGourmetEntries(entries: GourmetEntry[]) {
  const issues: GourmetQualityIssue[] = [];
  for (const entry of entries) {
    if (isUnknown(entry.restaurantName))
      issues.push({
        code: "missing-restaurant",
        entryId: entry.id,
        message: `${entry.restaurantName || "미상"} 기록의 가게명이 없습니다.`,
        severity: "error",
      });
    if (isUnknown(entry.menuName))
      issues.push({
        code: "unknown-menu",
        entryId: entry.id,
        message: `${entry.restaurantName || "미상"} 기록의 메뉴명이 없습니다.`,
        severity: "error",
      });
    if (!entry.visitedAt)
      issues.push({
        code: "missing-visited-at",
        entryId: entry.id,
        message: `${entry.restaurantName || "미상"} 기록의 방문일을 확인해 주세요.`,
        severity: "warning",
      });
    if (entry.status === "published" && entry.images.length === 0)
      issues.push({
        code: "missing-image",
        entryId: entry.id,
        message: `${entry.restaurantName || "미상"} 공개 기록에 사진이 없습니다.`,
        severity: "warning",
      });
    for (const image of entry.images) {
      if (
        isUnknown(image.altText) ||
        /미상|unknown/i.test(image.originalFilename)
      )
        issues.push({
          code: "unknown-image-metadata",
          entryId: entry.id,
          message: `${entry.restaurantName || "미상"} 사진의 설명 또는 원본 이름이 미확인입니다.`,
          severity: "warning",
        });
    }
  }
  return {
    errorCount: issues.filter((issue) => issue.severity === "error").length,
    issues,
    warningCount: issues.filter((issue) => issue.severity === "warning").length,
    totalEntries: entries.length,
  };
}
