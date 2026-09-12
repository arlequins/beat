"use client";

import {
  ArrowLeft,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Settings2,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Story } from "~/lib/fiction";
import { type Locale, localePath } from "~/lib/i18n";

const key = "beat-fiction-v1";
type Preferences = {
  size: number;
  line: number;
  theme: "paper" | "white" | "night";
  font: "serif" | "sans";
};
const defaults: Preferences = {
  size: 18,
  line: 1.9,
  theme: "paper",
  font: "sans",
};
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

export function FictionLibrary({
  stories,
  locale,
}: {
  stories: Story[];
  locale: Locale;
}) {
  const [liked, setLiked] = useState(false);
  const [last, setLast] = useState("");
  const [section, setSection] = useState("episodes");
  const [descending, setDescending] = useState(false);
  useEffect(() => {
    setLiked(read("liked", false));
    setLast(read("last", ""));
  }, []);
  const current = stories.find((story) => story.slug === last) ?? stories[0];
  return (
    <div className="novel-home" lang="ko">
      <header className="novel-summary">
        <p className="novel-category">판타지 · 옴니버스</p>
        <h1>여백의 사람들</h1>
        <p className="novel-description">
          하나의 세계에서 만나는 서로 다른 사람들의 이야기.
        </p>
        <div className="novel-facts">
          <span>총 {stories.length}화</span>
          <span>무료</span>
          <span>한국어</span>
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
            {liked ? "관심 작품" : "관심 등록"}
          </button>
          {current && (
            <Link
              className="novel-primary"
              href={localePath(locale, `/fiction/${current.slug}/`)}
            >
              {last === current.slug ? "이어보기" : "첫 화 보기"}
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
          회차 {stories.length}
        </button>
        <button
          type="button"
          aria-pressed={section === "about"}
          onClick={() => setSection("about")}
        >
          작품 소개
        </button>
      </div>
      {section === "episodes" ? (
        <section aria-label="회차 목록">
          <div className="novel-list-heading">
            <span>전체 {stories.length}화</span>
            <button type="button" onClick={() => setDescending(!descending)}>
              {descending ? "최신화부터 ↓" : "첫 화부터 ↑"}
            </button>
          </div>
          <ol>
            {[...stories]
              .sort((a, b) =>
                descending
                  ? b.episode.localeCompare(a.episode)
                  : a.episode.localeCompare(b.episode),
              )
              .map((story) => (
                <li key={story.slug}>
                  <Link
                    className="novel-episode"
                    href={localePath(locale, `/fiction/${story.slug}/`)}
                  >
                    <div>
                      <h2>
                        {Number(story.episode)}화. {story.title}
                      </h2>
                      <p>
                        {story.publishedAt.replaceAll("-", ".")} ·{" "}
                        {story.readTime}
                        {last === story.slug && <span>최근 읽음</span>}
                      </p>
                    </div>
                    <span className="novel-free">무료</span>
                    <ChevronRight size={16} />
                  </Link>
                </li>
              ))}
          </ol>
        </section>
      ) : (
        <section className="novel-about">
          <h2>여백의 사람들</h2>
          <p>
            하나의 세계, 저마다의 삶. 각 편이 독립적으로 완결되는 짧은 판타지
            소설입니다. 어느 이야기부터 읽어도 괜찮습니다.
          </p>
          <p>
            장르 · 판타지 / 옴니버스
            <br />
            본문 언어 · 한국어
          </p>
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
  const [preferences, setPreferences] = useState(defaults);
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(1);
  const [width, setWidth] = useState(0);
  const [panel, setPanel] = useState<"settings" | "episodes">("settings");
  const dialog = useRef<HTMLDialogElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const flow = useRef<HTMLDivElement>(null);
  const position = useRef(0);
  const ready = useRef(false);
  useEffect(() => {
    const stored = read<Preferences>("preferences", defaults);
    setPreferences({
      size: Math.max(14, Math.min(28, Number(stored.size) || 18)),
      line: Math.max(1.5, Math.min(2.5, Number(stored.line) || 1.9)),
      theme: ["white", "paper", "night"].includes(stored.theme)
        ? stored.theme
        : "paper",
      font: stored.font === "serif" ? "serif" : "sans",
    });
    position.current = Math.max(
      0,
      Math.min(1, Number(read(`book-position-${story.slug}`, 0)) || 0),
    );
    ready.current = true;
    save("last", story.slug);
  }, [story.slug]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Font settings change column pagination after rendering.
  useEffect(() => {
    const el = viewport.current;
    const text = flow.current;
    if (!el || !text) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const w = el.clientWidth;
        text.style.width = `${w - 48}px`;
        const pages = Math.max(1, Math.ceil((text.scrollWidth + 48) / w));
        const target = Math.min(
          pages - 1,
          Math.round(position.current * (pages - 1)),
        );
        setWidth(w);
        setCount(pages);
        setPage(target);
        requestAnimationFrame(() => {
          el.scrollLeft = target * w;
        });
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [preferences]);
  const change = (next: Partial<Preferences>) => {
    const value = { ...preferences, ...next };
    setPreferences(value);
    save("preferences", value);
  };
  const open = (next: "settings" | "episodes") => {
    setPanel(next);
    dialog.current?.showModal();
  };
  const turn = (delta: number) =>
    viewport.current?.scrollTo({
      left: Math.max(0, Math.min(count - 1, page + delta)) * width,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  const next =
    stories[stories.findIndex((item) => item.slug === story.slug) + 1];
  return (
    <div
      className={`novel-viewer book-viewer viewer-${preferences.theme}`}
      lang="ko"
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
      <div
        className="book-viewport"
        ref={viewport}
        role="region"
        aria-label="좌우로 넘기는 소설 본문"
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault();
            turn(event.key === "ArrowRight" ? 1 : -1);
          }
        }}
        onScroll={() => {
          const el = viewport.current;
          if (!el || !width) return;
          const current = Math.min(
            count - 1,
            Math.round(el.scrollLeft / width),
          );
          setPage(current);
          if (ready.current) {
            position.current = count > 1 ? current / (count - 1) : 0;
            save(`book-position-${story.slug}`, position.current);
          }
        }}
      >
        <div
          className="book-track"
          style={{ width: width ? `${count * width}px` : "100%" }}
        >
          <div className="book-flow viewer-prose" ref={flow}>
            <header className="book-title">
              <p>
                {story.series} · {Number(story.episode)}화
              </p>
              <h1 data-beat-context-title>{story.title}</h1>
            </header>
            {children}
            <div className="book-end">
              <p>― 끝 ―</p>
              {next ? (
                <Link href={localePath(locale, `/fiction/${next.slug}/`)}>
                  다음 이야기
                </Link>
              ) : (
                <Link href={localePath(locale, "/fiction/")}>
                  작품 목록으로
                </Link>
              )}
            </div>
          </div>
          <div className="book-snaps" aria-hidden="true">
            {Array.from({ length: count }, (_, index) => (
              <span
                key={`page-${index + 1}`}
                style={{ left: index * width, width }}
              />
            ))}
          </div>
        </div>
      </div>
      <footer className="book-controls">
        <Link href={localePath(locale, "/fiction/")} aria-label="작품 목록">
          <ArrowLeft size={18} />
        </Link>
        <button
          type="button"
          aria-label="이전 페이지"
          disabled={page === 0}
          onClick={() => turn(-1)}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          className="book-page-number"
          type="button"
          aria-label={`전체 ${count}쪽 중 ${page + 1}쪽, 회차 목록 열기`}
          onClick={() => open("episodes")}
        >
          {page + 1} / {count}
        </button>
        <button
          type="button"
          aria-label="다음 페이지"
          disabled={page === count - 1}
          onClick={() => turn(1)}
        >
          <ChevronRight size={18} />
        </button>
        <button
          type="button"
          aria-label="뷰어 설정"
          onClick={() => open("settings")}
        >
          <Settings2 size={18} />
        </button>
      </footer>
      <dialog ref={dialog} className="viewer-dialog">
        <header>
          <h2>{panel === "settings" ? "뷰어 설정" : "회차 목록"}</h2>
          <button
            type="button"
            aria-label="닫기"
            onClick={() => dialog.current?.close()}
          >
            <X size={20} />
          </button>
        </header>
        {panel === "settings" ? (
          <div className="viewer-settings">
            <fieldset>
              <legend>배경색</legend>
              <div>
                {(["white", "paper", "night"] as const).map((theme) => (
                  <button
                    type="button"
                    key={theme}
                    aria-pressed={preferences.theme === theme}
                    onClick={() => change({ theme })}
                  >
                    {{ white: "흰색", paper: "종이", night: "어둡게" }[theme]}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>글꼴</legend>
              <div>
                <button
                  type="button"
                  aria-pressed={preferences.font === "sans"}
                  onClick={() => change({ font: "sans" })}
                >
                  고딕
                </button>
                <button
                  type="button"
                  aria-pressed={preferences.font === "serif"}
                  onClick={() => change({ font: "serif" })}
                >
                  명조
                </button>
              </div>
            </fieldset>
            <label>
              글자 크기 <output>{preferences.size}px</output>
              <input
                type="range"
                min="14"
                max="28"
                value={preferences.size}
                onChange={(e) => change({ size: Number(e.target.value) })}
              />
            </label>
            <label>
              줄 간격 <output>{preferences.line.toFixed(1)}</output>
              <input
                type="range"
                min="1.5"
                max="2.5"
                step="0.1"
                value={preferences.line}
                onChange={(e) => change({ line: Number(e.target.value) })}
              />
            </label>
            <button
              className="viewer-reset"
              type="button"
              onClick={() => change(defaults)}
            >
              기본 설정으로
            </button>
            <p>읽기 설정과 기록은 이 브라우저에 저장됩니다.</p>
          </div>
        ) : (
          <ol className="viewer-episode-list">
            {stories.map((item) => (
              <li key={item.slug}>
                <Link
                  aria-current={item.slug === story.slug ? "page" : undefined}
                  href={localePath(locale, `/fiction/${item.slug}/`)}
                  onClick={() => dialog.current?.close()}
                >
                  {Number(item.episode)}화. {item.title}
                  {item.slug === story.slug && <span>읽는 중</span>}
                </Link>
              </li>
            ))}
          </ol>
        )}
      </dialog>
    </div>
  );
}
