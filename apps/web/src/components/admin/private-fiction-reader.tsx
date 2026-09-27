"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CSSProperties } from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  const [authenticated, setAuthenticated] = useState(false);
  const [manuscript, setManuscript] = useState<Manuscript>();
  const [message, setMessage] = useState("로그인 상태를 확인하고 있습니다.");
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [controlsVisible, setControlsVisible] = useState(false);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [pageWidth, setPageWidth] = useState(0);
  const [tocOpen, setTocOpen] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const flow = useRef<HTMLElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const lastTouch = useRef(0);
  const lastTap = useRef({ time: 0, x: 0, y: 0 });
  const touchStart = useRef({ x: 0, y: 0 });

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
  const selected =
    sections.find((section) => section.id === selectedId) ??
    readingOrder.find((section) => section.kind === "episode") ??
    readingOrder[0];

  useEffect(() => {
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
  }, [readingOrder, sections, selectedId]);

  useEffect(() => {
    if (selected) {
      window.localStorage.setItem("private-fiction-book-section", selected.id);
    }
  }, [selected]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Re-measure when the displayed episode changes.
  useLayoutEffect(() => {
    const el = viewport.current;
    const text = flow.current;
    if (!el || !text) return;
    let frame = 0;
    let active = true;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const width = el.clientWidth;
        const height = el.clientHeight;
        if (!width || !height) return;
        text.style.height = `${height}px`;
        text.style.width = `${width - 48}px`;
        text.style.columnWidth = `${width - 48}px`;
        const count = Math.max(1, Math.ceil((text.scrollWidth + 48) / width));
        setPageWidth(width);
        setPageCount(count);
        setPage(0);
        el.scrollLeft = 0;
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    const contentObserver = new MutationObserver(measure);
    contentObserver.observe(text, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    window.addEventListener("pageshow", measure);
    window.visualViewport?.addEventListener("resize", measure);
    document.fonts.addEventListener("loadingdone", measure);
    measure();
    document.fonts.ready.then(() => {
      if (active && el.isConnected) measure();
    });
    return () => {
      active = false;
      observer.disconnect();
      contentObserver.disconnect();
      window.removeEventListener("pageshow", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      document.fonts.removeEventListener("loadingdone", measure);
      cancelAnimationFrame(frame);
    };
  }, [selected?.id, selected?.content]);

  const selectedOrderIndex = selected
    ? readingOrder.findIndex((section) => section.id === selected.id)
    : -1;
  const previousSection = readingOrder[selectedOrderIndex - 1];
  const nextSection = readingOrder[selectedOrderIndex + 1];

  const chooseSection = (id: string) => {
    setSelectedId(id);
    setPage(0);
    setTocOpen(false);
    dialog.current?.close();
    viewport.current?.scrollTo({ left: 0, behavior: "instant" });
  };

  const changeSection = (delta: number) => {
    const target = readingOrder[selectedOrderIndex + delta];
    if (target) chooseSection(target.id);
  };

  const turn = (delta: number) => {
    const el = viewport.current;
    if (!el || !pageWidth) {
      if (delta > 0 && nextSection) changeSection(1);
      return;
    }
    const target = Math.max(0, Math.min(pageCount - 1, page + delta));
    if (target === page && delta > 0 && nextSection) {
      changeSection(1);
      return;
    }
    if (target === page && delta < 0 && previousSection) {
      changeSection(-1);
      requestAnimationFrame(() => {
        const previousFlow = flow.current;
        if (!previousFlow || !viewport.current) return;
        const previousPageCount = Math.max(
          1,
          Math.ceil(
            (previousFlow.scrollWidth + 48) / viewport.current.clientWidth,
          ),
        );
        const lastPage = previousPageCount - 1;
        viewport.current.scrollLeft = lastPage * viewport.current.clientWidth;
        setPage(lastPage);
      });
      return;
    }
    el.scrollLeft = target * pageWidth;
    setPage(target);
  };

  function showContents() {
    setTocOpen(true);
    dialog.current?.showModal();
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
      setManuscript((await response.json()) as Manuscript);
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
  if (!viewerContent) {
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
          {!authenticated && <a href="/admin/">관리자 로그인</a>}
          {authenticated && (
            <button disabled={busy} onClick={() => void load()} type="button">
              새로고침
            </button>
          )}
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
      className="novel-viewer book-viewer viewer-night private-fiction-book"
      lang="ko"
      style={
        {
          "--reader-size": "18px",
          "--reader-line": 1.9,
          "--reader-font": 'system-ui, "Apple SD Gothic Neo", sans-serif',
        } as CSSProperties
      }
    >
      <div
        className="book-viewport private-fiction-book-viewport"
        ref={viewport}
        role="region"
        aria-label="소설 본문. 화면 좌우를 클릭하거나 좌우로 밀어 페이지를 넘기세요. Enter 키를 누르면 목차와 도구를 엽니다."
        // biome-ignore lint/a11y/noNoninteractiveTabindex: The region provides keyboard paging controls.
        tabIndex={0}
        onClick={(event) => {
          if ((event.target as Element).closest("a, button, input, label"))
            return;
          const bounds = event.currentTarget.getBoundingClientRect();
          const x = event.clientX - bounds.left;
          if (x < bounds.width * 0.2) turn(-1);
          else if (x > bounds.width * 0.8) turn(1);
        }}
        onDoubleClick={(event) => {
          if ((event.target as Element).closest("a, button")) return;
          setControlsVisible((visible) => !visible);
        }}
        onPointerDown={(event) => {
          if (event.pointerType === "touch")
            touchStart.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={(event) => {
          if (
            event.pointerType !== "touch" ||
            !event.isPrimary ||
            (event.target as Element).closest("a, button")
          )
            return;
          lastTouch.current = performance.now();
          const x = event.clientX;
          const y = event.clientY;
          if (
            Math.hypot(x - touchStart.current.x, y - touchStart.current.y) > 12
          ) {
            lastTap.current.time = 0;
            return;
          }
          const now = performance.now();
          const previous = lastTap.current;
          if (
            now - previous.time < 350 &&
            Math.hypot(x - previous.x, y - previous.y) < 30
          ) {
            event.preventDefault();
            setControlsVisible((visible) => !visible);
            lastTap.current = { time: 0, x, y };
          } else lastTap.current = { time: now, x, y };
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "Enter") {
            event.preventDefault();
            setControlsVisible((visible) => !visible);
          }
          if (event.key === "Escape") setControlsVisible(false);
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault();
            turn(event.key === "ArrowRight" ? 1 : -1);
          }
        }}
        onScroll={() => {
          const el = viewport.current;
          if (!el || !pageWidth) return;
          setPage(
            Math.min(pageCount - 1, Math.round(el.scrollLeft / pageWidth)),
          );
        }}
      >
        <div
          className="book-track"
          style={{ width: pageWidth ? `${pageCount * pageWidth}px` : "100%" }}
        >
          <article className="book-flow viewer-prose" ref={flow}>
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
                    : "다음 문서 읽기 →"}
                </button>
              ) : (
                <button onClick={showContents} type="button">
                  목차로 돌아가기
                </button>
              )}
            </div>
          </article>
          <div className="book-snaps" aria-hidden="true">
            {Array.from({ length: pageCount }, (_, index) => (
              <span
                key={`page-${index + 1}`}
                style={{ left: index * pageWidth, width: pageWidth }}
              />
            ))}
          </div>
        </div>
      </div>
      <nav
        className="book-controls private-fiction-book-controls"
        aria-label="책보기 내비게이션"
        data-visible={controlsVisible}
        inert={!controlsVisible}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setControlsVisible(false);
            viewport.current?.focus();
          }
        }}
      >
        <button type="button" aria-label="목차 열기" onClick={showContents}>
          목차
        </button>
        <button type="button" aria-label="이전 페이지" onClick={() => turn(-1)}>
          <ChevronLeft size={18} />
        </button>
        <button
          className="book-page-number"
          type="button"
          aria-label={`페이지 ${page + 1} / ${pageCount}. 목차 열기`}
          onClick={showContents}
        >
          {page + 1} / {pageCount}
        </button>
        <button type="button" aria-label="다음 페이지" onClick={() => turn(1)}>
          <ChevronRight size={18} />
        </button>
      </nav>
      <dialog
        ref={dialog}
        className="viewer-dialog private-fiction-contents-dialog"
        onClose={() => setTocOpen(false)}
      >
        <header>
          <h2>{tocOpen ? "목차" : "비공개 원고"}</h2>
          <button
            type="button"
            aria-label="닫기"
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </header>
        <p className="private-fiction-dialog-status" role="status">
          {message}
        </p>
        <ol className="viewer-episode-list private-fiction-contents-list">
          {sections.map((section) => (
            <li key={section.id}>
              <button
                aria-current={section.id === selected.id ? "page" : undefined}
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
              onChange={(event) => void upload(event.currentTarget.files?.[0])}
              type="file"
            />
          </label>
          <button disabled={busy} onClick={() => void load()} type="button">
            새로고침
          </button>
        </footer>
      </dialog>
    </div>
  );
}
