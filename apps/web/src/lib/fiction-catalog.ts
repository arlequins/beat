import type { Story } from "~/lib/fiction";

export type WorldRelation = "shared" | "standalone" | "new";

export type NovelWorld = {
  id: string;
  title: string;
  description: string;
  guidePath?: string;
};

export const worldDefinitions: NovelWorld[] = [
  {
    id: "ordinary-tomorrow",
    title: "내일의 생활비 세계관",
    description: "AGI가 일상이 된 2041년, 서로 다른 속도로 내일을 사는 도시들.",
    guidePath: "/fiction/worlds/ordinary-tomorrow/",
  },
  {
    id: "yeobaek-river",
    title: "여백의 사람들 세계관",
    description: "전쟁이 지나간 강 하류의 생활권과 그곳에서 이어지는 이야기.",
    guidePath: "/fiction/guide/",
  },
  {
    id: "low-roof",
    title: "낮은 지붕 아래 세계관",
    description: "비가 그친 뒤에도 지붕 아래 남은 마음을 고치는 사람들의 세계.",
  },
];

export type NovelDefinition = {
  series: string;
  title: string;
  category: string;
  description: string;
  worldId: string;
  worldRelation: WorldRelation;
  status: string;
};

export type NovelCollection = NovelDefinition & {
  world: NovelWorld;
  stories: Story[];
};

export const novelDefinitions: NovelDefinition[] = [
  {
    series: "내일의 생활비",
    title: "내일의 생활비",
    category: "근미래 · 옴니버스",
    description:
      "서울, 뭄바이, 라고스, 상파울루, 런던. 편리해진 하루에 남은 작은 선택들이 바다를 건넌다.",
    worldId: "ordinary-tomorrow",
    worldRelation: "standalone",
    status: "1–5화 · 연재 중",
  },
  {
    series: "여백의 사람들",
    title: "여백의 사람들",
    category: "판타지 · 옴니버스",
    description:
      "전쟁이 지나간 강 하류에서 집과 밥과 이름을 다시 마련하는 사람들.",
    worldId: "yeobaek-river",
    worldRelation: "shared",
    status: "40화 완결",
  },
  {
    series: "낮은 지붕 아래",
    title: "낮은 지붕 아래",
    category: "환상 · 연작",
    description:
      "비가 그친 뒤에도 지붕 아래 남은 마음을 고치는 사람들의 이야기.",
    worldId: "low-roof",
    worldRelation: "new",
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

function getWorld(worldId: string): NovelWorld {
  return (
    worldDefinitions.find((world) => world.id === worldId) ?? {
      id: worldId,
      title: "새 세계관",
      description: "아직 정리 중인 새로운 세계.",
    }
  );
}

export function getWorldRelationLabel(relation: WorldRelation) {
  return {
    shared: "공유 세계관",
    standalone: "독립 세계관",
    new: "새 세계관",
  }[relation];
}

export function getNovelCollections(stories: Story[]): NovelCollection[] {
  const grouped = new Map<string, Story[]>();
  for (const story of stories) {
    grouped.set(story.series, [...(grouped.get(story.series) ?? []), story]);
  }

  const known = novelDefinitions
    .map((novel) => ({
      ...novel,
      world: getWorld(novel.worldId),
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
      worldId: series,
      worldRelation: "new" as const,
      status: "연재 중",
      world: getWorld(series),
      stories: sortStories(groupedStories),
    }));

  return [...known, ...unlisted];
}
