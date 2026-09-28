"use client";

import { Settings2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BookReader } from "~/components/blog/book-reader";
import {
  defaultReaderPreferences,
  type ReaderPreferences,
  ReaderSettingsPanel,
} from "~/components/blog/reader-settings";
import {
  authorizedBeatAdminRequest,
  BeatAdminSessionEvent,
  hasPersistentBeatAdminSession,
} from "~/lib/beat-admin-session";

type Manuscript = { etag: string; source: string; updatedAt: string };
type ManuscriptSection = {
  id: string;
  title: string;
  content: string;
  episode?: number;
  kind: "guide" | "episode" | "document";
};

function parseManuscript(source: string) {
  const headings = [...source.matchAll(/^#\s+(.+?)\s*$/gm)];
  const sections: ManuscriptSection[] = [];
  let introduction = "";

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    if (!heading) continue;
    const start = heading.index ?? 0;
    const bodyStart = start + heading[0].length;
    const end = headings[index + 1]?.index ?? source.length;
    const title = (heading[1] ?? "").trim();
    const content = source.slice(bodyStart, end).trim();

    if (index === 0 && title.includes("비공개 열람본")) {
      introduction = content;
      continue;
    }
    if (!content) continue;

    const episodeMatch = title.match(/^(\d+)\s*화(?:\s*[—–:-]\s*(.+))?$/);
    const kind = title.includes("설정집")
      ? "guide"
      : episodeMatch
        ? "episode"
        : "document";
    sections.push({
      id: `section-${sections.length + 1}`,
      title:
        episodeMatch?.[2]?.trim() ?? title.replace(/^《현실 오류》\s*/, ""),
      content,
      ...(episodeMatch ? { episode: Number(episodeMatch[1]) } : {}),
      kind,
    });
  }

  return { introduction, sections };
}

function inlineMarkdown(text: string) {
  const pattern =
    /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;
  return text.split(pattern).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <em key={index}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={index}>{part.slice(1, -1)}</code>;
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (link)
      return (
        <a href={link[2]} key={index} rel="noreferrer" target="_blank">
          {link[1]}
        </a>
      );
    return part;
  });
}

function MarkdownBlocks({ source }: { source: string }) {
  const lines = source.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let quote: string[] = [];
  let code: string[] = [];
  let inCode = false;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(
      <p key={`p-${blocks.length}`}>{inlineMarkdown(paragraph.join(" "))}</p>,
    );
    paragraph = [];
  };
  const flushList = () => {
    if (!list.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`}>
        {list.map((item, index) => (
          <li key={index}>{inlineMarkdown(item)}</li>
        ))}
      </ul>,
    );
    list = [];
  };
  const flushQuote = () => {
    if (!quote.length) return;
    blocks.push(
      <blockquote key={`quote-${blocks.length}`}>
        {quote.map((line, index) => (
          <p key={index}>{inlineMarkdown(line)}</p>
        ))}
      </blockquote>,
    );
    quote = [];
  };
  const flushCode = () => {
    if (!code.length) return;
    blocks.push(
      <pre key={`code-${blocks.length}`}>
        <code>{code.join("\n")}</code>
      </pre>,
    );
    code = [];
  };
  const flushTextBlocks = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const line of lines) {
    if (line.trimStart().startsWith("```")) {
      flushTextBlocks();
      if (inCode) flushCode();
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      code.push(line);
      continue;
    }
    const heading = line.match(/^(#{2,6})\s+(.+)$/);
    if (heading) {
      flushTextBlocks();
      const Heading = (heading[1] ?? "##").length <= 2 ? "h2" : "h3";
      blocks.push(
        <Heading key={`h-${blocks.length}`}>
          {inlineMarkdown(heading[2] ?? "")}
        </Heading>,
      );
      continue;
    }
    if (/^\s*([-*_]\s*){3,}$/.test(line)) {
      flushTextBlocks();
      blocks.push(<hr key={`hr-${blocks.length}`} />);
      continue;
    }
    const quoteLine = line.match(/^\s*>\s?(.*)$/);
    if (quoteLine) {
      flushParagraph();
      flushList();
      quote.push(quoteLine[1] ?? "");
      continue;
    }
    const listLine = line.match(/^\s*[-*+]\s+(.+)$/);
    if (listLine) {
      flushParagraph();
      flushQuote();
      list.push(listLine[1] ?? "");
      continue;
    }
    if (!line.trim()) {
      flushTextBlocks();
      continue;
    }
    flushList();
    flushQuote();
    paragraph.push(line.trim());
  }
  flushTextBlocks();
  if (inCode) flushCode();
  return <div className="viewer-prose private-fiction-prose">{blocks}</div>;
}

export function PrivateFictionReader() {
  const pathname = usePathname() ?? "/private/fictions/";
  const router = useRouter();
  const searchParams = useSearchParams();
  const routePart = pathname
    .replace(/^.*\/private\/fictions\/?/, "")
    .replace(/\/+$/, "");
  const requestedEpisode = searchParams.get("episode");
  const routeEpisode = requestedEpisode ? Number(requestedEpisode) : undefined;
  const isEpisodeRoute = routeEpisode !== undefined;
  const isListRoute = routePart === "list";
  const [authenticated, setAuthenticated] = useState(false);
  const [manuscript, setManuscript] = useState<Manuscript>();
  const [message, setMessage] = useState("로그인 상태를 확인하고 있습니다.");
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [tocOpen, setTocOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preferences, setPreferences] = useState(defaultReaderPreferences);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".ebook-shell");
    const background =
      preferences.theme === "white"
        ? "#fff"
        : preferences.theme === "paper"
          ? "#f5f0e6"
          : "#000";
    shell?.style.setProperty("--private-fiction-reader-background", background);
  }, [preferences.theme]);

  useEffect(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem("beat-fiction-v1-preferences") ?? "null",
      ) as Partial<ReaderPreferences> | null;
      setPreferences({
        size: Math.max(14, Math.min(28, Number(stored?.size) || 18)),
        line: Math.max(1.5, Math.min(2.5, Number(stored?.line) || 1.9)),
        theme: ["white", "paper", "night"].includes(stored?.theme ?? "")
          ? (stored?.theme as ReaderPreferences["theme"])
          : "night",
        font: stored?.font === "serif" ? "serif" : "sans",
      });
    } catch {
      setPreferences(defaultReaderPreferences);
    }
  }, []);

  const load = useCallback(async () => {
    if (!hasPersistentBeatAdminSession()) {
      setAuthenticated(false);
      setMessage(
        "기존 관리자 계정으로 로그인한 뒤 이 페이지를 다시 열어 주세요.",
      );
      return;
    }
    setBusy(true);
    try {
      const response = await authorizedBeatAdminRequest(
        "/admin/private-fiction",
        { cache: "no-store" },
      );
      if (response.status === 401) {
        setAuthenticated(false);
        setMessage("로그인이 만료되었습니다. 다시 로그인해 주세요.");
        return;
      }
      if (response.status === 404) {
        setAuthenticated(true);
        setMessage(
          "아직 보관된 원고가 없습니다. 로컬 파일을 선택해 처음 저장할 수 있습니다.",
        );
        setManuscript(undefined);
        return;
      }
      if (!response.ok) throw new Error("비공개 원고를 불러오지 못했습니다.");
      setManuscript((await response.json()) as Manuscript);
      setAuthenticated(true);
      setMessage("비공개 원고를 안전하게 불러왔습니다.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "원고를 불러오지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const sync = () => {
      if (!hasPersistentBeatAdminSession()) setAuthenticated(false);
    };
    window.addEventListener(BeatAdminSessionEvent, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(BeatAdminSessionEvent, sync);
      window.removeEventListener("storage", sync);
    };
  }, [load]);

  const parsed = useMemo(
    () => (manuscript ? parseManuscript(manuscript.source) : undefined),
    [manuscript],
  );
  const sections = parsed?.sections ?? [];
  const readingOrder = sections.filter(
    (section) => section.kind === "guide" || section.kind === "episode",
  );
  const episodes = readingOrder.filter((section) => section.kind === "episode");
  const routedSection = readingOrder.find(
    (section) => section.kind === "episode" && section.episode === routeEpisode,
  );
  const selected =
    sections.find((section) => section.id === selectedId) ??
    (isEpisodeRoute ? routedSection : (episodes[0] ?? readingOrder[0]));

  useEffect(() => {
    if (isEpisodeRoute || isListRoute) return;
    if (!readingOrder.length) return;
    const savedId = window.localStorage.getItem("private-fiction-book-section");
    const savedSection = readingOrder.find((section) => section.id === savedId);
    if (!selectedId || !sections.some((section) => section.id === selectedId)) {
      setSelectedId(
        savedSection?.id ??
          readingOrder.find((section) => section.kind === "episode")?.id ??
          readingOrder[0]?.id,
      );
    }
  }, [isEpisodeRoute, isListRoute, readingOrder, sections, selectedId]);

  useEffect(() => {
    if (selected) {
      window.localStorage.setItem("private-fiction-book-section", selected.id);
    }
  }, [selected]);

  const selectedOrderIndex = selected
    ? readingOrder.findIndex((section) => section.id === selected.id)
    : -1;
  const nextSection = readingOrder[selectedOrderIndex + 1];

  const chooseSection = (id: string, atEnd = false) => {
    const section = sections.find((item) => item.id === id);
    if (atEnd && section) {
      try {
        localStorage.setItem(
          `beat-fiction-v1-book-position-${section.id}`,
          "1",
        );
      } catch {
        // Reading remains available when browser storage is disabled.
      }
    }
    if (section?.kind === "episode" && section.episode) {
      setSelectedId(undefined);
      router.push(`/private/fictions/?episode=${section.episode}`, {
        scroll: false,
      });
    } else {
      setSelectedId(id);
    }
    setTocOpen(false);
    dialog.current?.close();
  };

  function showContents() {
    setTocOpen(true);
    setSettingsOpen(false);
    dialog.current?.showModal();
  }

  function showReaderSettings() {
    setTocOpen(false);
    setSettingsOpen(true);
    dialog.current?.showModal();
  }

  function changePreferences(next: Partial<ReaderPreferences>) {
    const value = { ...preferences, ...next };
    setPreferences(value);
    try {
      localStorage.setItem(
        "beat-fiction-v1-preferences",
        JSON.stringify(value),
      );
    } catch {
      // Reading settings still apply for this page when storage is unavailable.
    }
  }

  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const source = await file.text();
      const response = await authorizedBeatAdminRequest(
        "/admin/private-fiction",
        {
          body: JSON.stringify({
            expectedEtag: manuscript?.etag ?? null,
            source,
          }),
          method: "PUT",
        },
      );
      if (response.status === 409)
        throw new Error(
          "저장본이 바뀌었습니다. 새로고침한 뒤 다시 저장해 주세요.",
        );
      if (!response.ok) throw new Error("원고를 저장하지 못했습니다.");
      const saved = (await response.json()) as Pick<
        Manuscript,
        "etag" | "updatedAt"
      >;
      setManuscript({ ...saved, source });
      setSelectedId(undefined);
      setMessage("원고를 비공개 보관함에 저장했습니다.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "원고 저장에 실패했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }

  const viewerContent = authenticated && manuscript && parsed && selected;
  if (!authenticated || !manuscript || !parsed) {
    return (
      <section className="private-fiction-shell">
        <header className="private-fiction-header">
          <div>
            <p className="private-fiction-eyebrow">개인 열람 · 검색 비노출</p>
            <h1>비공개 원고 보관함</h1>
            <p className="private-fiction-status" role="status">
              {message}
            </p>
          </div>
          {!authenticated && <Link href="/admin/">관리자 로그인</Link>}
          {authenticated && (
            <button disabled={busy} onClick={() => void load()} type="button">
              새로고침
            </button>
          )}
        </header>
      </section>
    );
  }

  if (!isEpisodeRoute) {
    return (
      <section className="private-fiction-shell">
        <header className="private-fiction-header">
          <div>
            <p className="private-fiction-eyebrow">개인 열람 · 검색 비노출</p>
            <h1>비공개 소설</h1>
            <p className="private-fiction-status" role="status">
              {message}
            </p>
          </div>
          {isListRoute ? (
            <Link href="/private/fictions/">작품으로 돌아가기</Link>
          ) : null}
          <button disabled={busy} onClick={() => void load()} type="button">
            새로고침
          </button>
        </header>
        {isListRoute ? (
          <div className="private-fiction-library">
            <p className="private-fiction-eyebrow">현실 오류 · 회차 목록</p>
            <ol className="viewer-episode-list private-fiction-contents-list">
              {episodes.map((section) => (
                <li key={section.id}>
                  <button
                    onClick={() => chooseSection(section.id)}
                    type="button"
                  >
                    {section.episode}화. {section.title}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <div className="private-fiction-library-intro">
            <p>개인 보관 작품</p>
            <h2>현실 오류</h2>
            <p>회차를 골라 이어 읽을 수 있습니다.</p>
            <div className="private-fiction-library-actions">
              <Link href="/private/fictions/list/">회차 목록 보기</Link>
              {episodes[0] ? (
                <button
                  onClick={() => chooseSection(episodes[0]!.id)}
                  type="button"
                >
                  1화부터 읽기
                </button>
              ) : null}
            </div>
          </div>
        )}
      </section>
    );
  }

  if (!viewerContent) {
    return (
      <section className="private-fiction-shell">
        <header className="private-fiction-header">
          <h1>요청한 회차를 찾을 수 없습니다.</h1>
          <Link href="/private/fictions/list/">회차 목록으로 돌아가기</Link>
        </header>
      </section>
    );
  }

  const episodeLabel =
    selected.kind === "episode" && selected.episode
      ? `현실 오류 · ${selected.episode}화`
      : "작품 설정집";

  return (
    <div
      className={`novel-viewer book-viewer viewer-${preferences.theme} private-fiction-book`}
      lang="ko"
      style={
        {
          "--reader-size": `${preferences.size}px`,
          "--reader-line": preferences.line,
          "--reader-font":
            preferences.font === "serif"
              ? '"AppleMyungjo", "Batang", serif'
              : 'system-ui, "Apple SD Gothic Neo", sans-serif',
        } as CSSProperties
      }
    >
      <BookReader
        className="private-fiction-book-viewport"
        immersive
        label="소설 본문. 화면 좌우를 누르거나 밀어 페이지를 넘기세요. Enter 키를 누르면 메뉴가 열립니다."
        layoutKey={`${selected.id}:${preferences.size}:${preferences.line}:${preferences.font}`}
        onBoundaryTurn={(delta) => {
          const target = readingOrder[selectedOrderIndex + delta];
          if (target) chooseSection(target.id, delta < 0);
        }}
        positionKey={selected.id}
        waitForLayout
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
            <article className="book-flow viewer-prose" ref={flowRef}>
              <header className="book-title">
                <p>{episodeLabel}</p>
                <h1>{selected.title}</h1>
              </header>
              <div className="book-article-body">
                <MarkdownBlocks source={selected.content} />
              </div>
              <div className="book-end">
                <p>― 여기까지 읽었습니다 ―</p>
                {nextSection ? (
                  <button
                    className="private-fiction-next-episode"
                    onClick={() => chooseSection(nextSection.id)}
                    type="button"
                  >
                    {nextSection.kind === "episode" && nextSection.episode
                      ? `${nextSection.episode}화 이어 읽기 →`
                      : "다음 문서로 이동 →"}
                  </button>
                ) : (
                  <button onClick={showContents} type="button">
                    목차로 돌아가기
                  </button>
                )}
              </div>
            </article>
            <nav
              className="book-controls private-fiction-book-controls"
              aria-label="책보기 내비게이션"
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
                aria-label="목차 열기"
                onClick={showContents}
              >
                목차
              </button>
              <Link href="/private/fictions/list/">회차 목록</Link>
              <Link href="/admin/">Admin</Link>
              <button
                type="button"
                aria-label="읽기 설정"
                onClick={() => {
                  setControlsVisible(false);
                  showReaderSettings();
                }}
              >
                <Settings2 size={18} />
              </button>
              <button
                type="button"
                aria-label="이전 페이지"
                onClick={() => turn(-1)}
              >
                ‹
              </button>
              <button
                className="book-page-number"
                type="button"
                aria-label={`페이지 ${page + 1} / ${pageCount}. 목차 열기`}
                onClick={showContents}
              >
                {page + 1} / {pageCount}
              </button>
              <button
                type="button"
                aria-label="다음 페이지"
                onClick={() => turn(1)}
              >
                ›
              </button>
            </nav>
          </>
        )}
      </BookReader>
      <dialog
        ref={dialog}
        className="viewer-dialog private-fiction-contents-dialog"
        onClose={() => {
          setTocOpen(false);
          setSettingsOpen(false);
        }}
      >
        <header>
          <h2>
            {settingsOpen ? "읽기 설정" : tocOpen ? "목차" : "비공개 원고"}
          </h2>
          <button
            type="button"
            aria-label="닫기"
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </header>
        {settingsOpen ? (
          <ReaderSettingsPanel
            labels={{
              background: "배경색",
              font: "글꼴",
              size: "글자 크기",
              line: "줄 간격",
              reset: "기본 설정으로",
              stored: "읽기 설정은 공개 소설과 함께 이 브라우저에 저장됩니다.",
              white: "흰색",
              paper: "종이",
              night: "어둡게",
              sans: "고딕",
              serif: "명조",
            }}
            onChange={changePreferences}
            preferences={preferences}
          />
        ) : (
          <>
            <p className="private-fiction-dialog-status" role="status">
              {message}
            </p>
            <ol className="viewer-episode-list private-fiction-contents-list">
              {sections.map((section) => (
                <li key={section.id}>
                  <button
                    aria-current={
                      section.id === selected.id ? "page" : undefined
                    }
                    onClick={() => chooseSection(section.id)}
                    type="button"
                  >
                    {section.kind === "episode" && section.episode
                      ? `${section.episode}화. ${section.title}`
                      : section.title}
                    {section.id === selected.id && <span>읽는 중</span>}
                  </button>
                </li>
              ))}
            </ol>
            <footer className="private-fiction-dialog-actions">
              <label className="private-fiction-upload">
                원고 Markdown 불러오기
                <input
                  accept=".md,.mdx,text/markdown,text/plain"
                  disabled={busy}
                  onChange={(event) =>
                    void upload(event.currentTarget.files?.[0])
                  }
                  type="file"
                />
              </label>
              <button disabled={busy} onClick={() => void load()} type="button">
                새로고침
              </button>
            </footer>
          </>
        )}
      </dialog>
    </div>
  );
}
