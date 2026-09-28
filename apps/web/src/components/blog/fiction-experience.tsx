"use client";

import {
  ArrowLeft,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Moon,
  Settings2,
  Sun,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { BookReader } from "~/components/blog/book-reader";
import { FictionComments } from "~/components/blog/fiction-comments";
import {
  defaultReaderPreferences,
  type ReaderPreferences as Preferences,
  ReaderSettingsPanel,
} from "~/components/blog/reader-settings";
import type { Story } from "~/lib/fiction";
import {
  getNovelCollections,
  getWorldRelationLabel,
} from "~/lib/fiction-catalog";
import { type Locale, localePath } from "~/lib/i18n";

const key = "beat-fiction-v1";
const episodePageSize = 40;
function read<T>(name: string, fallback: T): T {
  try {
    return (
      JSON.parse(localStorage.getItem(`${key}-${name}`) ?? "null") ?? fallback
    );
  } catch {
    return fallback;
  }
}
function save(name: string, value: unknown) {
  try {
    localStorage.setItem(`${key}-${name}`, JSON.stringify(value));
  } catch {
    /* Reading remains available without storage. */
  }
}

function readerSurfaceColor(theme: Preferences["theme"]) {
  if (theme === "night") return "#000000";
  if (theme === "white") return "#ffffff";
  return "#f5f0e6";
}

const fictionUi = {
  ko: {
    libraryTitle: "읽을 소설을 고르세요",
    libraryDescription:
      "작품을 고르고, 그 작품이 가진 세계의 규칙과 사람들의 시간으로 들어갑니다.",
    library: "작품 목록",
    stories: "작품",
    total: "총",
    language: "한국어",
    guide: "세계관·설정집 읽기 →",
    firstBackground: "이 작품에서 처음 여는 배경",
    interest: "관심 등록",
    interested: "관심 작품",
    resume: "이어보기",
    first: "첫",
    view: "보기",
    about: "작품 소개",
    all: "전체",
    last: "마지막 편부터 ↓",
    newest: "최신화부터 ↓",
    firstFrom: "첫",
    previous: "이전",
    next: "다음",
    recent: "최근 읽음",
    genre: "장르",
    bodyLanguage: "본문 언어",
    pageList: "회차 목록",
    readingOrder: "문서 읽기 순서",
    settings: "뷰어 설정",
    comments: "독자 코멘트",
    commentAction: "코멘트",
    close: "닫기",
    bg: "배경색",
    font: "글꼴",
    size: "글자 크기",
    line: "줄 간격",
    reset: "기본 설정으로",
    stored: "읽기 설정과 기록은 이 브라우저에 저장됩니다.",
    white: "흰색",
    paper: "종이",
    night: "어둡게",
    sans: "고딕",
    serif: "명조",
    hideNav: "내비게이션 숨기기",
    prevPage: "이전 페이지",
    nextPage: "다음 페이지",
    openEpisodes: "회차 목록 열기",
    finish: "― 끝 ―",
    nextStory: "다음 이야기",
    storyList: "작품 목록으로",
    nav: "책보기 내비게이션",
    viewport:
      "좌우로 넘기는 소설 본문. 두 번 탭하거나 Enter 키로 내비게이션 열기",
    light: "밝은 배경으로 전환",
    dark: "어두운 배경으로 전환",
    reading: "읽는 중",
    end: "마지막 편부터 ↓",
    start: "첫",
    lastPart: "마지막 편부터 ↓",
    latest: "최신화부터 ↓",
    read: "읽기",
    episodes: "회차",
    works: "편",
    sortPages: "회차 목록 페이지",
    catalogNav: "설정집 탐색",
    novelList: "소설 목록",
    guideIndex: "설정집 목차",
    guideSource: "이 문서의 마크다운 원본",
    nextDoc: "다음:",
    libraryIntro:
      "위에서부터 읽으면 강 하류의 생활과 소설 전체를 관통하는 길이 이어집니다.",
    libraryFooter:
      "문서는 위 순서로 이어지며, 각 페이지의 라벨은 설정의 결을 보여줍니다. 웹 본문은 마크다운 원본에서 생성됩니다.",
    guideIntro:
      "이 문서는 소설을 읽기 위한 세계의 안내입니다. 아직 이름이 없는 곳과 여러 갈래로 전해지는 약속은 이야기 속에서 드러납니다.",
    guideTitle: "세계부터, 하나씩",
    guideStatus: "설정집",
    tomorrowNav: "세계관 탐색",
    firstEpisode: "1화 읽기",
    tomorrowIntro:
      "작품 속 도시와 사람들의 일상을 소개합니다. 회차의 결말은 담지 않았습니다.",
    tomorrowLabel: "내일의 생활비 · 독립 세계관",
    tomorrowTitle: "조금 먼저 온 일상",
  },
  en: {
    libraryTitle: "Choose a story to read",
    libraryDescription:
      "Choose a work and step into the rules of its world and the lives within it.",
    library: "Library",
    stories: "works",
    total: "Total",
    language: "Korean",
    guide: "Read the world guide →",
    firstBackground: "The world begins in this work",
    interest: "Add to favorites",
    interested: "In your favorites",
    resume: "Continue reading",
    first: "Read from the",
    view: "",
    about: "About this work",
    all: "All",
    last: "Last story first ↓",
    newest: "Latest episode first ↓",
    firstFrom: "First",
    previous: "Previous",
    next: "Next",
    recent: "Last read",
    genre: "Genre",
    bodyLanguage: "Text language",
    pageList: "Episode list",
    readingOrder: "Reading order",
    settings: "Reader settings",
    comments: "Reader comments",
    commentAction: "Comments",
    close: "Close",
    bg: "Background",
    font: "Font",
    size: "Text size",
    line: "Line spacing",
    reset: "Reset to defaults",
    stored: "Reading settings and progress are saved in this browser.",
    white: "White",
    paper: "Paper",
    night: "Night",
    sans: "Sans serif",
    serif: "Serif",
    hideNav: "Hide navigation",
    prevPage: "Previous page",
    nextPage: "Next page",
    openEpisodes: "Open episode list",
    finish: "— The End —",
    nextStory: "Next story",
    storyList: "Back to the library",
    nav: "Reader navigation",
    viewport:
      "Story text. Swipe left or right, or press Enter to open navigation.",
    light: "Switch to a light background",
    dark: "Switch to a dark background",
    reading: "Reading",
    end: "Last story first ↓",
    start: "First",
    lastPart: "Last story first ↓",
    latest: "Latest episode first ↓",
    read: "Read",
    episodes: "episodes",
    works: "stories",
    sortPages: "Episode list pages",
    catalogNav: "World guide navigation",
    novelList: "Story library",
    guideIndex: "Guide contents",
    guideSource: "Markdown source for this guide",
    nextDoc: "Next:",
    libraryIntro:
      "Read from the beginning to follow life along the lower river and the thread running through the stories.",
    libraryFooter:
      "Read the guide in order. Page labels reveal the shape of this world. The web version is generated from Markdown.",
    guideIntro:
      "This guide introduces the world behind the stories. Unnamed places and promises passed down in many forms will unfold in the narrative.",
    guideTitle: "Start with the world",
    guideStatus: "World guide",
    tomorrowNav: "World guide navigation",
    firstEpisode: "Read episode 1",
    tomorrowIntro:
      "Meet the cities and everyday lives in this work. Episode endings are not revealed.",
    tomorrowLabel: "The Cost of Tomorrow · standalone world",
    tomorrowTitle: "Everyday life, a little ahead",
  },
  ja: {
    libraryTitle: "読む小説を選んでください",
    libraryDescription:
      "作品を選び、その世界のルールと人々の時間へ入っていきます。",
    library: "作品一覧",
    stories: "作品",
    total: "全",
    language: "韓国語",
    guide: "世界観・設定資料を読む →",
    firstBackground: "この作品から始まる世界",
    interest: "お気に入りに追加",
    interested: "お気に入り",
    resume: "続きを読む",
    first: "最初の",
    view: "を読む",
    about: "作品紹介",
    all: "全",
    last: "最終話から ↓",
    newest: "最新話から ↓",
    firstFrom: "最初の",
    previous: "前へ",
    next: "次へ",
    recent: "最近読んだ話",
    genre: "ジャンル",
    bodyLanguage: "本文の言語",
    pageList: "話一覧",
    readingOrder: "読む順序",
    settings: "閲覧設定",
    comments: "読者コメント",
    commentAction: "コメント",
    close: "閉じる",
    bg: "背景色",
    font: "フォント",
    size: "文字サイズ",
    line: "行間",
    reset: "初期設定に戻す",
    stored: "閲覧設定と読書記録はこのブラウザーに保存されます。",
    white: "白",
    paper: "紙",
    night: "ダーク",
    sans: "ゴシック",
    serif: "明朝",
    hideNav: "ナビゲーションを隠す",
    prevPage: "前のページ",
    nextPage: "次のページ",
    openEpisodes: "話一覧を開く",
    finish: "― おわり ―",
    nextStory: "次の物語",
    storyList: "作品一覧へ",
    nav: "読書ナビゲーション",
    viewport:
      "小説本文。左右にスワイプするか Enter キーでナビゲーションを開きます。",
    light: "明るい背景に切り替える",
    dark: "暗い背景に切り替える",
    reading: "読書中",
    end: "最終話から ↓",
    start: "最初の",
    lastPart: "最終話から ↓",
    latest: "最新話から ↓",
    read: "を読む",
    episodes: "話",
    works: "作品",
    sortPages: "話一覧のページ",
    catalogNav: "設定資料のナビゲーション",
    novelList: "小説一覧",
    guideIndex: "設定資料の目次",
    guideSource: "この文書の Markdown 原文",
    nextDoc: "次へ:",
    libraryIntro:
      "最初から読むと、川下の暮らしと物語全体を貫く道がつながります。",
    libraryFooter:
      "文書は上から順に続きます。各ページのラベルが世界観の輪郭を示します。Web 本文は Markdown 原文から生成されます。",
    guideIntro:
      "この文書は小説を読むための世界案内です。まだ名のない場所や、さまざまに伝わる約束は物語の中で明らかになります。",
    guideTitle: "世界から、ひとつずつ",
    guideStatus: "設定資料",
    tomorrowNav: "世界観ナビゲーション",
    firstEpisode: "第1話を読む",
    tomorrowIntro:
      "作品に登場する街と人々の日常を紹介します。各話の結末には触れません。",
    tomorrowLabel: "明日の生活費 · 独立した世界",
    tomorrowTitle: "少し先に来た日常",
  },
} as const;

function itemUnit(unit: "episode" | "story", locale: Locale) {
  if (locale === "en") return unit === "story" ? " stories" : " episodes";
  if (locale === "ja") return unit === "story" ? "作品" : "話";
  return unit === "story" ? "편" : "화";
}

function itemName(unit: "episode" | "story", locale: Locale) {
  if (locale === "en") return unit === "story" ? "Stories" : "Episodes";
  if (locale === "ja") return unit === "story" ? "作品" : "話";
  return unit === "story" ? "단편" : "회차";
}

function firstItemLabel(unit: "episode" | "story", locale: Locale) {
  if (locale === "en")
    return unit === "story" ? "Read the first story" : "Read the first episode";
  if (locale === "ja")
    return unit === "story" ? "最初の作品を読む" : "第1話を読む";
  return `첫 ${itemUnit(unit, locale)} 보기`;
}

export function FictionLibrary({
  stories,
  locale,
}: {
  stories: Story[];
  locale: Locale;
}) {
  const t = fictionUi[locale];
  const novels = getNovelCollections(stories);
  const [liked, setLiked] = useState(false);
  const [last, setLast] = useState("");
  const [selectedSeries, setSelectedSeries] = useState(novels[0]?.series ?? "");
  const [section, setSection] = useState("episodes");
  const [descending, setDescending] = useState(false);
  const [episodePage, setEpisodePage] = useState(0);
  useEffect(() => {
    setLiked(read("liked", false));
    const savedLast = read("last", "");
    setLast(savedLast);
    const savedStory = stories.find((story) => story.slug === savedLast);
    if (savedStory) {
      setSelectedSeries(savedStory.series);
      const savedNovel = getNovelCollections(stories).find(
        (novel) => novel.series === savedStory.series,
      );
      const savedIndex =
        savedNovel?.stories.findIndex((story) => story.slug === savedLast) ??
        -1;
      setEpisodePage(
        savedIndex < 0 ? 0 : Math.floor(savedIndex / episodePageSize),
      );
    }
  }, [stories]);
  const selected =
    novels.find((novel) => novel.series === selectedSeries) ?? novels[0];
  const current =
    selected?.stories.find((story) => story.slug === last) ??
    selected?.stories[0];
  const selectedStories = [...(selected?.stories ?? [])].sort((a, b) => {
    const result = Number(a.episode) - Number(b.episode);
    return descending ? -result : result;
  });
  const episodePageCount = Math.max(
    1,
    Math.ceil(selectedStories.length / episodePageSize),
  );
  const visibleStories = selectedStories.slice(
    episodePage * episodePageSize,
    (episodePage + 1) * episodePageSize,
  );
  return (
    <div className="novel-home" lang={locale}>
      <header className="novel-summary">
        <div className="novel-summary-copy">
          <p className="novel-library-kicker">BEAT FICTION LIBRARY</p>
          <h1>{t.libraryTitle}</h1>
          <p className="novel-description">{t.libraryDescription}</p>
        </div>
        <div className="novel-summary-aside">
          <span className="novel-summary-mark" aria-hidden="true">
            {String(novels.length).padStart(2, "0")}
          </span>
          <div className="novel-facts">
            <span>
              {novels.length} {t.works}
            </span>
            <span>
              {t.total} {stories.length}
            </span>
            <span>{t.language}</span>
          </div>
        </div>
      </header>
      <section className="novel-shelf" aria-labelledby="novel-shelf-title">
        <div className="novel-shelf-heading">
          <div>
            <p>LIBRARY</p>
            <h2 id="novel-shelf-title">{t.library}</h2>
          </div>
          <span>
            {novels.length} {t.works}
          </span>
        </div>
        <div className="novel-picker">
          {novels.map((novel, index) => (
            <button
              className={`novel-card novel-card-${index + 1}`}
              type="button"
              aria-pressed={novel.series === selected?.series}
              key={novel.series}
              onClick={() => {
                setSelectedSeries(novel.series);
                setSection("episodes");
                setEpisodePage(0);
              }}
            >
              <span className="novel-card-index" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="novel-card-copy">
                <span className="novel-card-topline">
                  <span className="novel-card-category">{novel.category}</span>
                  <span className="novel-card-arrow" aria-hidden="true">
                    <ChevronRight size={18} />
                  </span>
                </span>
                <strong>{novel.title}</strong>
                <span>{novel.description}</span>
                <span className="novel-card-bottomline">
                  <small className="novel-card-world">
                    {getWorldRelationLabel(novel.worldRelation)} ·{" "}
                    {novel.world.title}
                  </small>
                  <small>
                    {novel.stories.length}
                    {itemUnit(novel.unit, locale)} · {novel.status}
                  </small>
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {selected && (
        <section
          className="novel-selection"
          aria-labelledby="selected-novel-title"
        >
          <header className="novel-selection-header">
            <div>
              <p className="novel-category">{selected.category}</p>
              <h2 id="selected-novel-title">{selected.title}</h2>
              <p>{selected.description}</p>
              <div className="novel-world-row">
                <span>
                  <span lang="ko">
                    {getWorldRelationLabel(selected.worldRelation)} ·{" "}
                    {selected.world.title}
                  </span>
                </span>
                {selected.world.guidePath ? (
                  <Link href={localePath(locale, selected.world.guidePath)}>
                    {t.guide}
                  </Link>
                ) : (
                  <span>{t.firstBackground}</span>
                )}
              </div>
              <div className="novel-facts">
                <span>
                  {t.total} {selected.stories.length}
                  {itemUnit(selected.unit, locale)}
                </span>
                <span>{selected.status}</span>
              </div>
            </div>
            <div className="novel-actions">
              <button
                type="button"
                aria-pressed={liked}
                onClick={() => {
                  setLiked(!liked);
                  save("liked", !liked);
                }}
              >
                <Bookmark size={17} fill={liked ? "currentColor" : "none"} />
                {liked ? t.interested : t.interest}
              </button>
              {current && (
                <Link
                  className="novel-primary"
                  href={localePath(locale, `/fiction/${current.slug}/`)}
                >
                  {last === current.slug
                    ? t.resume
                    : firstItemLabel(selected.unit, locale)}
                  <ChevronRight size={18} />
                </Link>
              )}
            </div>
          </header>
          <div className="novel-tabs">
            <button
              type="button"
              aria-pressed={section === "episodes"}
              onClick={() => setSection("episodes")}
            >
              {itemName(selected.unit, locale)} {selected.stories.length}
            </button>
            <button
              type="button"
              aria-pressed={section === "about"}
              onClick={() => setSection("about")}
            >
              {t.about}
            </button>
          </div>
          {section === "episodes" ? (
            <section aria-label={`${selected.title} ${t.pageList}`}>
              <div className="novel-list-heading">
                <span>
                  {t.all} {selected.stories.length}
                  {itemUnit(selected.unit, locale)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDescending(!descending);
                    setEpisodePage(0);
                  }}
                >
                  {descending
                    ? selected.unit === "story"
                      ? t.last
                      : t.newest
                    : `${t.firstFrom}${itemUnit(selected.unit, locale)} ↑`}
                </button>
              </div>
              {episodePageCount > 1 ? (
                <nav aria-label={t.sortPages} className="site-pagination">
                  <button
                    type="button"
                    disabled={episodePage === 0}
                    onClick={() => setEpisodePage((page) => page - 1)}
                  >
                    {t.previous} {itemName(selected.unit, locale)}
                  </button>
                  <span aria-live="polite">
                    {episodePage * episodePageSize + 1}–
                    {Math.min(
                      (episodePage + 1) * episodePageSize,
                      selectedStories.length,
                    )}{" "}
                    / {selectedStories.length}
                    {itemUnit(selected.unit, locale)}
                  </span>
                  <button
                    type="button"
                    disabled={episodePage >= episodePageCount - 1}
                    onClick={() => setEpisodePage((page) => page + 1)}
                  >
                    {t.next} {itemName(selected.unit, locale)}
                  </button>
                </nav>
              ) : null}
              <ol>
                {visibleStories.map((story) => (
                  <li key={story.slug}>
                    <Link
                      className="novel-episode"
                      href={localePath(locale, `/fiction/${story.slug}/`)}
                    >
                      <div>
                        <h3>
                          {Number(story.episode)}
                          {itemUnit(selected.unit, locale)}. {story.title}
                        </h3>
                        <p>
                          {story.publishedAt.replaceAll("-", ".")} ·{" "}
                          {story.readTime}
                          {last === story.slug && <span>{t.recent}</span>}
                        </p>
                      </div>
                      <ChevronRight size={16} />
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          ) : (
            <section className="novel-about">
              <h3>{selected.title}</h3>
              <p>{selected.description}</p>
              <p>
                {t.genre} · <span lang="ko">{selected.category}</span>
                <br />
                {t.bodyLanguage} · {t.language}
              </p>
            </section>
          )}
        </section>
      )}
    </div>
  );
}

export function FictionViewer({
  story,
  stories,
  locale,
  children,
}: {
  story: Story;
  stories: Story[];
  locale: Locale;
  children: ReactNode;
}) {
  const t = fictionUi[locale];
  const [preferences, setPreferences] = useState(defaultReaderPreferences);
  const [panel, setPanel] = useState<"settings" | "episodes" | "comments">(
    "settings",
  );
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const stored = read<Preferences>("preferences", defaultReaderPreferences);
    setPreferences({
      size: Math.max(14, Math.min(28, Number(stored.size) || 18)),
      line: Math.max(1.5, Math.min(2.5, Number(stored.line) || 1.9)),
      theme: ["white", "paper", "night"].includes(stored.theme)
        ? stored.theme
        : "night",
      font: stored.font === "serif" ? "serif" : "sans",
    });
    save("last", story.slug);
  }, [story.slug]);
  useLayoutEffect(() => {
    // Safari paints its top and bottom safe areas from the document surface,
    // outside the fixed book viewer. The head bootstrap paints this before
    // hydration; this effect keeps client navigation and theme changes in step.
    const html = document.documentElement;
    const themeColors = document.querySelectorAll<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    const originalThemeColor =
      html.dataset.siteThemeColor ?? themeColors[0]?.content;
    if (originalThemeColor) html.dataset.siteThemeColor = originalThemeColor;
    const bootTheme = html.dataset.readerTheme;
    const theme = ["white", "paper", "night"].includes(bootTheme ?? "")
      ? (bootTheme as Preferences["theme"])
      : preferences.theme;
    html.dataset.readerTheme = theme;
    themeColors.forEach((themeColor) => {
      themeColor.content = readerSurfaceColor(theme);
    });

    return () => {
      delete html.dataset.readerTheme;
      if (originalThemeColor !== undefined) {
        themeColors.forEach((themeColor) => {
          themeColor.content = originalThemeColor;
        });
      }
      delete html.dataset.siteThemeColor;
    };
  }, [preferences.theme]);
  const change = (next: Partial<Preferences>) => {
    const value = { ...preferences, ...next };
    if (next.theme) {
      const html = document.documentElement;
      html.dataset.readerTheme = value.theme;
      const themeColors = document.querySelectorAll<HTMLMetaElement>(
        'meta[name="theme-color"]',
      );
      themeColors.forEach((themeColor) => {
        themeColor.content = readerSurfaceColor(value.theme);
      });
    }
    setPreferences(value);
    save("preferences", value);
  };
  const open = (next: "settings" | "episodes" | "comments") => {
    setPanel(next);
    dialog.current?.showModal();
  };
  const novelStories = stories.filter((item) => item.series === story.series);
  const novel = getNovelCollections(stories).find(
    (item) => item.series === story.series,
  );
  const unit = itemUnit(novel?.unit ?? "episode", locale);
  const next =
    novelStories[
      novelStories.findIndex((item) => item.slug === story.slug) + 1
    ];
  return (
    <div
      className={`novel-viewer book-viewer viewer-${preferences.theme}`}
      lang={locale}
      style={
        {
          "--reader-size": `${preferences.size}px`,
          "--reader-line": preferences.line,
          "--reader-font":
            preferences.font === "serif"
              ? '"AppleMyungjo", "Batang", serif'
              : "system-ui, sans-serif",
        } as CSSProperties
      }
    >
      <BookReader
        label={t.viewport}
        layoutKey={`${story.slug}:${preferences.size}:${preferences.line}:${preferences.font}`}
        positionKey={story.slug}
      >
        {({
          flowRef,
          page,
          pageCount,
          controlsVisible,
          setControlsVisible,
          turn,
          viewportRef,
        }) => (
          <>
            <article
              className="book-flow viewer-prose"
              ref={flowRef}
              itemScope
              itemType="https://schema.org/Article"
            >
              <meta itemProp="datePublished" content={story.publishedAt} />
              <meta itemProp="inLanguage" content="ko" />
              <header className="book-title" lang="ko">
                <p>
                  {story.series} · {Number(story.episode)}
                  {unit}
                </p>
                <h1 itemProp="headline" data-beat-context-title>
                  {story.title}
                </h1>
              </header>
              <div
                className="book-article-body"
                itemProp="articleBody"
                lang="ko"
              >
                {children}
              </div>
              <div className="book-end">
                <p>{t.finish}</p>
                {next ? (
                  <Link href={localePath(locale, `/fiction/${next.slug}/`)}>
                    {t.nextStory}
                  </Link>
                ) : (
                  <Link href={localePath(locale, "/fiction/")}>
                    {t.storyList}
                  </Link>
                )}
              </div>
            </article>
            <nav
              className="book-controls"
              aria-label={t.nav}
              data-visible={controlsVisible}
              inert={!controlsVisible}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setControlsVisible(false);
                  viewportRef.current?.focus();
                }
              }}
            >
              <button
                type="button"
                aria-label={t.hideNav}
                onClick={() => {
                  setControlsVisible(false);
                  viewportRef.current?.focus();
                }}
              >
                <X size={18} />
              </button>
              <Link
                href={localePath(locale, "/fiction/")}
                aria-label={t.storyList}
              >
                <ArrowLeft size={18} />
              </Link>
              <button
                type="button"
                aria-label={t.prevPage}
                disabled={page === 0}
                onClick={() => turn(-1)}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="book-page-number"
                type="button"
                aria-label={`${t.total} ${pageCount} · ${page + 1}, ${t.openEpisodes}`}
                onClick={() => open("episodes")}
              >
                {page + 1} / {pageCount}
              </button>
              <button
                type="button"
                aria-label={t.nextPage}
                disabled={page === pageCount - 1}
                onClick={() => turn(1)}
              >
                <ChevronRight size={18} />
              </button>
              <button
                type="button"
                aria-label={t.commentAction}
                onClick={() => open("comments")}
              >
                <MessageCircle size={18} />
              </button>
              <button
                type="button"
                aria-label={preferences.theme === "night" ? t.light : t.dark}
                onClick={() =>
                  change({
                    theme: preferences.theme === "night" ? "paper" : "night",
                  })
                }
              >
                {preferences.theme === "night" ? (
                  <Sun size={18} />
                ) : (
                  <Moon size={18} />
                )}
              </button>
              <button
                type="button"
                aria-label={t.settings}
                onClick={() => open("settings")}
              >
                <Settings2 size={18} />
              </button>
            </nav>
          </>
        )}
      </BookReader>
      <dialog ref={dialog} className="viewer-dialog">
        <header>
          <h2>
            {panel === "settings"
              ? t.settings
              : panel === "episodes"
                ? t.pageList
                : t.comments}
          </h2>
          <button
            type="button"
            aria-label={t.close}
            onClick={() => dialog.current?.close()}
          >
            <X size={20} />
          </button>
        </header>
        {panel === "settings" ? (
          <ReaderSettingsPanel
            labels={{
              background: t.bg,
              font: t.font,
              size: t.size,
              line: t.line,
              reset: t.reset,
              stored: t.stored,
              white: t.white,
              paper: t.paper,
              night: t.night,
              sans: t.sans,
              serif: t.serif,
            }}
            onChange={change}
            preferences={preferences}
          />
        ) : panel === "episodes" ? (
          <ol className="viewer-episode-list">
            {novelStories.map((item) => (
              <li key={item.slug}>
                <Link
                  aria-current={item.slug === story.slug ? "page" : undefined}
                  href={localePath(locale, `/fiction/${item.slug}/`)}
                  onClick={() => dialog.current?.close()}
                >
                  {Number(item.episode)}
                  {unit}. {item.title}
                  {item.slug === story.slug && <span>{t.reading}</span>}
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <FictionComments story={story} locale={locale} />
        )}
      </dialog>
    </div>
  );
}
