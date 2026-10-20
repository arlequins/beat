export type ManuscriptSection = {
  id: string;
  title: string;
  content: string;
  episode?: number;
  kind: "guide" | "episode" | "document";
};

const arcPartPattern = /^(.+?)\s+-\s*(\d+)$/u;

function hasArcEpisodeSequence(
  source: string,
  arcs: RegExpMatchArray[],
  episodes: RegExpMatchArray[],
) {
  if (
    episodes.length < 2 ||
    arcs.length === 0 ||
    [...source.matchAll(/^##\s+(.+?)\s*$/gm)].length !== episodes.length ||
    episodes.some(
      (heading, index) =>
        Number(heading[1]?.match(/^(\d+)/)?.[1]) !== index + 1,
    ) ||
    arcs.some((heading) =>
      /^\d+\s*화(?:\s*[.．—–:-]|$)/u.test(heading[1] ?? ""),
    )
  ) {
    return false;
  }

  let consumed = 0;
  for (const [index, arc] of arcs.entries()) {
    const start = arc.index ?? 0;
    const end = arcs[index + 1]?.index ?? source.length;
    const title = (arc[1] ?? "").trim().replace(/^\d+\s*장[.．]\s*/u, "");
    const parts = episodes.filter(
      (heading) => (heading.index ?? 0) > start && (heading.index ?? 0) < end,
    );
    if (!title || parts.length === 0) return false;
    for (const [partIndex, heading] of parts.entries()) {
      const explicitTitle = heading[1]?.match(
        /^\d+\s*화\s*[.．—–:-]\s*(.+)$/u,
      )?.[1];
      if (parts.length === 1 && explicitTitle === title) continue;
      const part = explicitTitle?.match(arcPartPattern);
      if (part?.[1]?.trim() !== title || Number(part?.[2]) !== partIndex + 1) {
        return false;
      }
    }
    consumed += parts.length;
  }
  return consumed === episodes.length;
}

export function parseManuscript(source: string) {
  const arcHeadings = [...source.matchAll(/^#\s+(.+?)\s*$/gm)];
  const episodeHeadings = [
    ...source.matchAll(/^##\s+(\d+\s*화(?:\s*[.．—–:-]\s*.+)?)\s*$/gm),
  ];
  const arcEpisodeSequence = hasArcEpisodeSequence(
    source,
    arcHeadings,
    episodeHeadings,
  );
  const boundarySequence =
    arcEpisodeSequence ||
    /^# 《각자의 현실》\r?\n(?:\r?\n)?## Reality Error: Boundary(?:\r?\n|$)/u.test(
      source,
    );
  const headings = [
    ...arcHeadings,
    ...(boundarySequence ? episodeHeadings : []),
  ].sort((left, right) => (left.index ?? 0) - (right.index ?? 0));
  const sections: ManuscriptSection[] = [];
  let introduction = "";
  let arcTitle = "";
  let arcPart = 0;
  let pendingCover = "";
  let sequenceArcTitle = "";

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    if (!heading) continue;
    const start = heading.index ?? 0;
    const bodyStart = start + heading[0].length;
    const end = headings[index + 1]?.index ?? source.length;
    const title = (heading[1] ?? "").trim();
    let content = source.slice(bodyStart, end).trim();

    if (arcEpisodeSequence && /^#\s/u.test(heading[0])) {
      sequenceArcTitle = title.replace(/^\d+\s*장[.．]\s*/u, "");
    }

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
    const coverStoryTitle = title.replace(/^\d+\s*장[.．]\s*/u, "");
    const followingPart = arcEpisodeSequence
      ? followingEpisode?.match(arcPartPattern)
      : undefined;
    const coverMatches = arcEpisodeSequence
      ? followingEpisode === coverStoryTitle ||
        (followingPart?.[1]?.trim() === coverStoryTitle &&
          Number(followingPart?.[2]) === 1)
      : followingEpisode === coverStoryTitle ||
        followingEpisode === `${coverStoryTitle} - 1`;
    // Original book covers precede their episode H1. Keep the epigraph in that
    // episode's rendered content without changing the stored manuscript bytes.
    if (
      kind === "document" &&
      (arcEpisodeSequence || content.endsWith("<!-- PAGE_BREAK -->")) &&
      coverMatches
    ) {
      pendingCover = `## ${title}\n\n${content}\n\n`;
      continue;
    }
    let sectionTitle = title.replace(/^《현실 오류》\s*/, "");
    if (episodeMatch) {
      const explicitTitle =
        episodeMatch[2]?.trim() ?? content.match(/^##\s+(.+)$/m)?.[1]?.trim();
      const sequenceSingleton =
        arcEpisodeSequence && explicitTitle === sequenceArcTitle;
      const numberedTitle = sequenceSingleton
        ? null
        : explicitTitle?.match(
            arcEpisodeSequence ? arcPartPattern : /^(.+?)\s+(?:-\s*)?(\d+)$/,
          );
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
        (pendingCover || arcEpisodeSequence) && explicitTitle && !numberedTitle
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
