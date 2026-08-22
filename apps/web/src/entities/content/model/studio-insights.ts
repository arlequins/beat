export type StudioContentRecord = {
  category?: string;
  origin: "draft" | "repository";
  reviewStatus?: "reviewed" | "unreviewed";
  revision: number;
  slug: string;
  status: "confirmed" | "draft" | "published";
  title: string;
  updatedAt?: string;
};

export type StudioHealth = {
  confirmed: number;
  drafts: number;
  needsAttention: number;
  published: number;
  reviewed: number;
  total: number;
  unreviewed: number;
};

export function studioHealth(records: StudioContentRecord[]): StudioHealth {
  return records.reduce<StudioHealth>(
    (summary, record) => {
      summary.total += 1;
      if (record.status === "draft") summary.drafts += 1;
      if (record.status === "confirmed") summary.confirmed += 1;
      if (record.status === "published") summary.published += 1;
      if (record.reviewStatus === "reviewed") summary.reviewed += 1;
      if (record.reviewStatus === "unreviewed") summary.unreviewed += 1;
      if (
        !record.title.trim() ||
        !record.slug.trim() ||
        !record.category?.trim() ||
        record.reviewStatus === "unreviewed"
      )
        summary.needsAttention += 1;
      return summary;
    },
    {
      confirmed: 0,
      drafts: 0,
      needsAttention: 0,
      published: 0,
      reviewed: 0,
      total: 0,
      unreviewed: 0,
    },
  );
}

export function recentStudioRecords(records: StudioContentRecord[], limit = 4) {
  return [...records]
    .sort((left, right) => {
      const leftTime = left.updatedAt ? Date.parse(left.updatedAt) : 0;
      const rightTime = right.updatedAt ? Date.parse(right.updatedAt) : 0;
      return rightTime - leftTime;
    })
    .slice(0, limit);
}
