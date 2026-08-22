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
