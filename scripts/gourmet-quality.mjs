import process from "node:process";

function isUnknown(value) {
  return !value?.trim() || value.trim().toLocaleLowerCase() === "미상";
}

/**
 * Read-only public data quality check. This intentionally does not mutate
 * Gourmet records: a missing image is a warning that needs human review.
 */
export function auditPublicGourmetEntries(entries) {
  const issues = [];
  for (const entry of entries) {
    const restaurant = entry.restaurantName || "미상";
    if (isUnknown(entry.restaurantName))
      issues.push({
        code: "missing-restaurant",
        entryId: entry.id ?? "unknown",
        message: `${restaurant} 기록의 가게명이 없습니다.`,
        severity: "error",
      });
    if (isUnknown(entry.menuName))
      issues.push({
        code: "unknown-menu",
        entryId: entry.id ?? "unknown",
        message: `${restaurant} 기록의 메뉴명이 없습니다.`,
        severity: "error",
      });
    if (!entry.visitedAt)
      issues.push({
        code: "missing-visited-at",
        entryId: entry.id ?? "unknown",
        message: `${restaurant} 기록의 방문일을 확인해 주세요.`,
        severity: "warning",
      });
    if (!Array.isArray(entry.images) || entry.images.length === 0)
      issues.push({
        code: "missing-image",
        entryId: entry.id ?? "unknown",
        message: `${restaurant} 공개 기록에 사진이 없습니다.`,
        severity: "warning",
      });
    for (const image of entry.images ?? []) {
      if (
        isUnknown(image.altText) ||
        /미상|unknown/i.test(image.originalFilename ?? "")
      )
        issues.push({
          code: "unknown-image-metadata",
          entryId: entry.id ?? "unknown",
          message: `${restaurant} 사진의 설명 또는 원본 이름이 미확인입니다.`,
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

export async function fetchGourmetQuality(baseUrl, request = fetch) {
  const url = new URL("/api/gourmet/entries?page=1&pageSize=100", baseUrl);
  if (url.protocol !== "https:")
    throw new Error("Production endpoint must use HTTPS");
  const response = await request(url);
  if (!response.ok)
    throw new Error(`Gourmet list returned HTTP ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload?.entries))
    throw new Error("Gourmet list has no entries array");
  return auditPublicGourmetEntries(payload.entries);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const baseUrl = process.argv[2];
  if (!baseUrl) {
    console.error(
      "Usage: node scripts/gourmet-quality.mjs https://api.example.com",
    );
    process.exit(2);
  }
  try {
    const report = await fetchGourmetQuality(baseUrl);
    for (const issue of report.issues)
      console.log(
        `${issue.severity}|${issue.code}|${issue.entryId}|${issue.message}`,
      );
    if (report.issues.length > 0) process.exitCode = 1;
    else console.log(`GOURMET_QUALITY_OK ${report.totalEntries} entries`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
