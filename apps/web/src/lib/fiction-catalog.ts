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
  {
    id: "under-table-star",
    title: "식탁 아래의 별 세계관",
    description:
      "말하지 못한 가족의 마음이 오래된 식탁 아래에서 다시 만나는 세계.",
  },
  {
    id: "sixth-key",
    title: "여섯 번째 열쇠 세계관",
    description: "지도에서 사라진 방과 아직 주소를 찾지 못한 사람들의 세계.",
  },
  {
    id: "cloud-archive",
    title: "구름 보관소 세계관",
    description: "기억을 품은 비와 구름을 보관하는 기후 이후의 세계.",
  },
  {
    id: "late-reply",
    title: "기억보다 늦은 답장 세계관",
    description: "도착할 때를 잃은 말들이 시간을 건너오는 세계.",
  },
  {
    id: "borrowed-forest-name",
    title: "숲의 이름을 빌린 날 세계관",
    description: "이름을 건네는 일이 생명을 지키는 약속이 되는 숲의 세계.",
  },
  {
    id: "footsteps-wall",
    title: "벽 너머의 발소리 세계관",
    description: "기억과 현재 사이에 얇은 벽 하나가 남아 있는 도시의 세계.",
  },
  {
    id: "lost-post-station",
    title: "사라진 역참의 등불 세계관",
    description:
      "지도에서 지워진 길에도 사람의 선택을 기다리는 역참이 남은 세계.",
  },
  {
    id: "blue-island",
    title: "파란 섬의 마지막 지도 세계관",
    description: "섬과 바다가 함께 이동하며 새로운 지도를 요구하는 해양 세계.",
  },
  {
    id: "after-work-elevator",
    title: "퇴근하지 않는 엘리베이터 세계관",
    description:
      "하루를 마치기 전 하지 못한 말을 잠시 멈춰 세우는 도시의 세계.",
  },
  {
    id: "borrowed-names",
    title: "이름을 빌려드립니다 세계관",
    description: "이름이 권리이자 화폐가 된 도시에서 자기 이름을 되찾는 세계.",
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
  {
    series: "식탁 아래의 별",
    title: "식탁 아래의 별",
    category: "문학 · 가족",
    description: "오래된 식탁 아래 숨겨 둔 가족의 말이 다시 자리를 찾는다.",
    worldId: "under-table-star",
    worldRelation: "new",
    status: "1화 · 단편",
  },
  {
    series: "여섯 번째 열쇠",
    title: "여섯 번째 열쇠",
    category: "미스터리 · 단편",
    description: "지도에서 사라진 방을 여는 열쇠가 한 사람의 주소를 찾아간다.",
    worldId: "sixth-key",
    worldRelation: "new",
    status: "1화 · 단편",
  },
  {
    series: "구름 보관소",
    title: "구름 보관소",
    category: "기후 SF · 단편",
    description: "보관된 비 한 병이 잊힌 사람의 계절을 다시 하늘로 돌려보낸다.",
    worldId: "cloud-archive",
    worldRelation: "new",
    status: "1화 · 단편",
  },
  {
    series: "기억보다 늦은 답장",
    title: "기억보다 늦은 답장",
    category: "로맨스 · 단편",
    description: "십 년 늦게 도착한 답장은 기다림을 끝내는 방법이 된다.",
    worldId: "late-reply",
    worldRelation: "new",
    status: "1화 · 단편",
  },
  {
    series: "숲의 이름을 빌린 날",
    title: "숲의 이름을 빌린 날",
    category: "판타지 · 우화",
    description:
      "이름 하나를 빌려준 사람이 숲과 함께 사라지지 않는 법을 배운다.",
    worldId: "borrowed-forest-name",
    worldRelation: "new",
    status: "1화 · 단편",
  },
  {
    series: "벽 너머의 발소리",
    title: "벽 너머의 발소리",
    category: "심리 공포 · 단편",
    description: "닫힌 벽 너머의 발소리가 떠나보내지 못한 시간을 두드린다.",
    worldId: "footsteps-wall",
    worldRelation: "new",
    status: "1화 · 단편",
  },
  {
    series: "사라진 역참의 등불",
    title: "사라진 역참의 등불",
    category: "시대극 · 단편",
    description: "지도에서 지워진 역참의 등불이 전령에게 하루의 시간을 건넨다.",
    worldId: "lost-post-station",
    worldRelation: "new",
    status: "1화 · 단편",
  },
  {
    series: "파란 섬의 마지막 지도",
    title: "파란 섬의 마지막 지도",
    category: "해양 모험 · 단편",
    description:
      "움직이는 섬의 마지막 지도는 끝이 아니라 다음 위치를 기록한다.",
    worldId: "blue-island",
    worldRelation: "new",
    status: "1화 · 단편",
  },
  {
    series: "퇴근하지 않는 엘리베이터",
    title: "퇴근하지 않는 엘리베이터",
    category: "오피스 코미디 · 단편",
    description: "멈춘 엘리베이터가 하루를 끝내기 전 하지 못한 말을 묻는다.",
    worldId: "after-work-elevator",
    worldRelation: "new",
    status: "1화 · 단편",
  },
  {
    series: "이름을 빌려드립니다",
    title: "이름을 빌려드립니다",
    category: "디스토피아 · 사회",
    description: "이름이 권리가 된 도시에서 한 사람이 아이에게 이름을 건넨다.",
    worldId: "borrowed-names",
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
