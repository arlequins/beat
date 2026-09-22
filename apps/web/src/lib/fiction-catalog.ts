import type { Story } from "~/lib/fiction";

export type NovelDefinition = {
  series: string;
  title: string;
  category: string;
  description: string;
  status: string;
};

export type NovelCollection = NovelDefinition & {
  stories: Story[];
};

export const novelDefinitions: NovelDefinition[] = [
  {
    series: "여백의 사람들",
    title: "여백의 사람들",
    category: "판타지 · 옴니버스",
    description:
      "전쟁이 지나간 강 하류에서 집과 밥과 이름을 다시 마련하는 사람들.",
    status: "40화 완결",
  },
  {
    series: "낮은 지붕 아래",
    title: "낮은 지붕 아래",
    category: "환상 · 연작",
    description:
      "비가 그친 뒤에도 지붕 아래 남은 마음을 고치는 사람들의 이야기.",
    status: "새 연재",
  },
];

function episodeNumber(story: Story) {
  return Number.parseInt(story.episode, 10) || 0;
}

function sortStories(stories: Story[]) {
  return [...stories].sort(
    (a, b) =>
      episodeNumber(a) - episodeNumber(b) || a.title.localeCompare(b.title),
  );
}

export function getNovelCollections(stories: Story[]): NovelCollection[] {
  const grouped = new Map<string, Story[]>();
  for (const story of stories) {
    grouped.set(story.series, [...(grouped.get(story.series) ?? []), story]);
  }

  const known = novelDefinitions
    .map((novel) => ({
      ...novel,
      stories: sortStories(grouped.get(novel.series) ?? []),
    }))
    .filter((novel) => novel.stories.length > 0);
  const knownSeries = new Set(known.map((novel) => novel.series));
  const unlisted = [...grouped.entries()]
    .filter(([series]) => !knownSeries.has(series))
    .map(([series, groupedStories]) => ({
      series,
      title: series,
      category: "소설",
      description: "새로 시작하는 이야기.",
      status: "연재 중",
      stories: sortStories(groupedStories),
    }));

  return [...known, ...unlisted];
}
