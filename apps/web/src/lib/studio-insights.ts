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

export type TimelineEntry = {
  createdAt: string;
  id: string;
  visitedAt: string | null;
};

export type TimelineGroup<T extends TimelineEntry> = {
  entries: T[];
  key: string;
  label: string;
};

export function gourmetTimeline<T extends TimelineEntry>(
  entries: T[],
  locale: string,
) {
  const groups = new Map<string, T[]>();
  for (const entry of entries) {
    const date = entry.visitedAt ?? entry.createdAt.slice(0, 10);
    const key = date.slice(0, 7);
    const current = groups.get(key) ?? [];
    current.push(entry);
    groups.set(key, current);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([key, group]) => ({
      entries: [...group].sort((left, right) => {
        const leftDate = left.visitedAt ?? left.createdAt;
        const rightDate = right.visitedAt ?? right.createdAt;
        return rightDate.localeCompare(leftDate);
      }),
      key,
      label: new Intl.DateTimeFormat(locale, {
        month: "long",
        year: "numeric",
      }).format(new Date(`${key}-01T00:00:00Z`)),
    })) satisfies TimelineGroup<T>[];
}
