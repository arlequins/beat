export type ManuscriptSection = {
  id: string;
  title: string;
  content: string;
  episode?: number;
  kind: "guide" | "episode" | "document";
};

export function parseManuscript(source: string) {
  const headings = [...source.matchAll(/^#\s+(.+?)\s*$/gm)];
  const sections: ManuscriptSection[] = [];
  let introduction = "";
  let arcTitle = "";
  let arcPart = 0;
  let pendingCover = "";

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    if (!heading) continue;
    const start = heading.index ?? 0;
    const bodyStart = start + heading[0].length;
    const end = headings[index + 1]?.index ?? source.length;
    const title = (heading[1] ?? "").trim();
    let content = source.slice(bodyStart, end).trim();

    if (index === 0 && title.includes("비공개 열람본")) {
      introduction = content;
      continue;
    }
    if (!content) continue;

    const episodeMatch = title.match(/^(\d+)\s*화(?:\s*[.．—–:-]\s*(.+))?$/);
    const kind = title.includes("설정집")
      ? "guide"
      : episodeMatch
        ? "episode"
        : "document";
    const followingTitle = headings[index + 1]?.[1]?.trim();
    const followingEpisode = followingTitle?.match(
      /^\d+\s*화\s*[.．—–:-]\s*(.+)$/,
    )?.[1];
    // Original book covers precede their episode H1. Keep the epigraph in that
    // episode's rendered content without changing the stored manuscript bytes.
    if (
      kind === "document" &&
      content.endsWith("<!-- PAGE_BREAK -->") &&
      (followingEpisode === title || followingEpisode === `${title} - 1`)
    ) {
      pendingCover = `## ${title}\n\n${content}\n\n`;
      continue;
    }
    let sectionTitle = title.replace(/^《현실 오류》\s*/, "");
    if (episodeMatch) {
      const explicitTitle = episodeMatch[2]?.trim();
      const numberedTitle = explicitTitle?.match(/^(.+?)\s+(?:-\s*)?(\d+)$/);
      const coverTitle = content.includes("<!-- PAGE_BREAK -->")
        ? content
            .split("<!-- PAGE_BREAK -->")[0]
            ?.match(/^##\s+(.+)$/m)?.[1]
            ?.trim()
        : undefined;
      if (numberedTitle) {
        arcTitle = numberedTitle[1]!.trim();
        arcPart = Number(numberedTitle[2]);
      } else if (explicitTitle || coverTitle) {
        arcTitle = explicitTitle ?? coverTitle!;
        arcPart = 1;
      } else {
        arcPart += 1;
      }
      sectionTitle =
        pendingCover && explicitTitle && !numberedTitle
          ? explicitTitle
          : arcTitle
            ? `${arcTitle} - ${arcPart}`
            : "";
      content = pendingCover + content;
      pendingCover = "";
    }
    sections.push({
      id: `section-${sections.length + 1}`,
      title: sectionTitle,
      content,
      ...(episodeMatch ? { episode: Number(episodeMatch[1]) } : {}),
      kind,
    });
  }

  return { introduction, sections };
}
