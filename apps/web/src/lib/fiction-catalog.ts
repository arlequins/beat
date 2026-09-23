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
    description:
      "2041년, 불확실해진 내일을 앞두고 일하고 사랑하며 살아가는 사람들.",
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
  {
    id: "mailbox-season",
    title: "우편함의 계절 세계관",
    description: "도착하지 못한 말이 새벽의 우편함을 통해 다시 길을 찾는 세계.",
  },
  {
    id: "last-transfer",
    title: "마지막 환승 세계관",
    description: "지도에서 지워진 노선과 아직 떠나지 않은 사람들의 도시.",
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
    category: "일상 · 로맨스 · 근미래",
    description:
      "돌아온 동창, 잘못 가져온 우산, 화면 너머의 식탁. 불안한 뉴스가 흐르는 일곱 도시에서 사람들은 다음 약속을 잡는다.",
    worldId: "ordinary-tomorrow",
    worldRelation: "standalone",
    status: "1–20화 · 연재 중",
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
  {
    series: "우편함의 계절",
    title: "우편함의 계절",
    category: "현대 판타지 · 단편",
    description:
      "도착하지 못한 말들이 새벽 네 시의 우편함에서 다시 길을 찾는다.",
    worldId: "mailbox-season",
    worldRelation: "new",
    status: "1화 · 단편",
  },
  {
    series: "마지막 환승",
    title: "마지막 환승",
    category: "SF · 단편",
    description:
      "지도에서 지워진 역 앞에서, 떠나는 사람은 마지막 행선지를 고른다.",
    worldId: "last-transfer",
    worldRelation: "new",
    status: "1화 · 단편",
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
