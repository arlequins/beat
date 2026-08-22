function tokens(value) {
  return String(value ?? "")
    .toLocaleLowerCase("ko-KR")
    .replace(/미상|unknown|none/g, " ")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 2);
}

export function matchScore(entry, text) {
  const haystack = String(text ?? "").toLocaleLowerCase("ko-KR");
  const fields = [
    entry.restaurantName,
    entry.menuName,
    entry.summary,
    ...(entry.tasteNotes ?? []),
  ];
  let score = 0;
  for (const field of fields) {
    const normalized = String(field ?? "")
      .toLocaleLowerCase("ko-KR")
      .trim();
    if (!normalized || normalized === "미상") continue;
    if (haystack.includes(normalized)) score += 8;
    for (const token of tokens(normalized))
      if (haystack.includes(token)) score += 1;
  }
  const rating = String(entry.rating);
  if (new RegExp(`(?:^|\\s)${rating}(?:점|\\s|$)`).test(text)) score += 3;
  return score;
}

export function rankEntries(entries, text) {
  return entries
    .map((entry) => ({ entry, score: matchScore(entry, text) }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        String(left.entry.id).localeCompare(String(right.entry.id)),
    );
}

export function buildAssignments(groups) {
  const grouped = new Map();
  for (const group of groups ?? []) {
    if (typeof group?.entryId !== "string") continue;
    const current = grouped.get(group.entryId) ?? [];
    current.push(...(Array.isArray(group.images) ? group.images : []));
    grouped.set(group.entryId, current);
  }
  return [...grouped].map(([entryId, images]) => ({ entryId, images }));
}
