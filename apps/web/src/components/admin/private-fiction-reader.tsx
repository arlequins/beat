"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
      title: title.replace(/^《현실 오류》\s*/, ""),
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
  return <>{blocks}</>;
}

function PaginatedReadingPage({ source }: { source: string }) {
  const viewport = useRef<HTMLDivElement>(null);
  const flow = useRef<HTMLDivElement>(null);
  const pageRef = useRef(0);
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(1);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const view = viewport.current;
    const content = flow.current;
    if (!view || !content) return;
    let frame = 0;
    let restoreFrame = 0;
    let active = true;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const nextWidth = view.clientWidth;
        const height = view.clientHeight;
        if (!nextWidth || !height) return;
        const columnWidth = Math.max(1, nextWidth - 48);
        content.style.height = `${height}px`;
        content.style.width = `${columnWidth}px`;
        content.style.columnWidth = `${columnWidth}px`;
        const nextCount = Math.max(
          1,
          Math.ceil((content.scrollWidth + 48) / nextWidth),
        );
        const nextPage = Math.min(pageRef.current, nextCount - 1);
        pageRef.current = nextPage;
        setWidth(nextWidth);
        setCount(nextCount);
        setPage(nextPage);
        cancelAnimationFrame(restoreFrame);
        restoreFrame = requestAnimationFrame(() => {
          view.scrollLeft = nextPage * nextWidth;
        });
      });
    };
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(view);
    const contentObserver = new MutationObserver(measure);
    contentObserver.observe(content, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    document.fonts.addEventListener("loadingdone", measure);
    window.visualViewport?.addEventListener("resize", measure);
    measure();
    document.fonts.ready.then(() => {
      if (active && view.isConnected) measure();
    });
    return () => {
      active = false;
      resizeObserver.disconnect();
      contentObserver.disconnect();
      document.fonts.removeEventListener("loadingdone", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(restoreFrame);
    };
  }, []);

  const turn = (delta: number) => {
    const nextPage = Math.max(0, Math.min(count - 1, page + delta));
    pageRef.current = nextPage;
    setPage(nextPage);
    if (viewport.current && width)
      viewport.current.scrollTo({ left: nextPage * width, behavior: "smooth" });
  };

  return (
    <>
      <div
        className="private-fiction-book-viewport"
        ref={viewport}
        onScroll={() => {
          if (!width || !viewport.current) return;
          const nextPage = Math.max(
            0,
            Math.min(
              count - 1,
              Math.round(viewport.current.scrollLeft / width),
            ),
          );
          pageRef.current = nextPage;
          setPage(nextPage);
        }}
      >
        <div
          className="private-fiction-book-flow private-fiction-prose fiction-prose"
          ref={flow}
        >
          <MarkdownBlocks source={source} />
        </div>
      </div>
      <nav className="private-fiction-page-nav" aria-label="페이지 이동">
        <button
          aria-label="이전 페이지"
          disabled={page === 0}
          onClick={() => turn(-1)}
          type="button"
        >
          ‹ 이전
        </button>
        <span aria-live="polite">
          {page + 1} / {count}
        </span>
        <button
          aria-label="다음 페이지"
          disabled={page >= count - 1}
          onClick={() => turn(1)}
          type="button"
        >
          다음 ›
        </button>
      </nav>
    </>
  );
}

export function PrivateFictionReader() {
  const [authenticated, setAuthenticated] = useState(false);
  const [manuscript, setManuscript] = useState<Manuscript>();
  const [message, setMessage] = useState("로그인 상태를 확인하고 있습니다.");
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();

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
        {
          cache: "no-store",
        },
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
  const selectedIndex = Math.max(
    0,
    sections.findIndex((section) => section.id === selectedId),
  );
  const selected = sections[selectedIndex];

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
      setAuthenticated(true);
      setMessage("원고를 비공개 보관함에 저장했습니다.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "원고 저장에 실패했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }

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
        <div className="private-fiction-actions">
          {!authenticated && <Link href="/admin/">관리자 로그인</Link>}
          {authenticated && (
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
          )}
          {authenticated && (
            <button disabled={busy} onClick={() => void load()} type="button">
              새로고침
            </button>
          )}
        </div>
      </header>

      {manuscript && authenticated && parsed && (
        <>
          <div className="private-fiction-work-heading">
            <div>
              <p>장편 연재 · 정본 열람</p>
              <h2>현실 오류</h2>
              {parsed.introduction && <p>{parsed.introduction}</p>}
            </div>
            <span>저장 {new Date(manuscript.updatedAt).toLocaleString()}</span>
          </div>
          <div className="private-fiction-reading-layout">
            <nav className="private-fiction-toc" aria-label="원고 목차">
              <p>
                목차 <span>{sections.length}개 문서</span>
              </p>
              <ol>
                {sections.map((section, index) => (
                  <li key={section.id}>
                    <button
                      aria-current={
                        section.id === selected?.id ? "page" : undefined
                      }
                      onClick={() => setSelectedId(section.id)}
                      type="button"
                    >
                      <span>
                        {section.kind === "episode"
                          ? `${section.episode}화`
                          : section.kind === "guide"
                            ? "설정"
                            : "문서"}
                      </span>
                      <strong>{section.title}</strong>
                    </button>
                    {index === 0 && sections[index + 1]?.kind === "episode" && (
                      <hr />
                    )}
                  </li>
                ))}
              </ol>
            </nav>
            {selected ? (
              <article className="private-fiction-page">
                <header className="private-fiction-page-title">
                  <p>
                    {selected.kind === "episode"
                      ? `현실 오류 · ${selected.episode}화`
                      : selected.kind === "guide"
                        ? "작품 설정집"
                        : "작품 문서"}
                  </p>
                  <h1>{selected.title}</h1>
                </header>
                <PaginatedReadingPage
                  key={selected.id}
                  source={selected.content}
                />
                <footer className="private-fiction-document-nav">
                  <button
                    disabled={selectedIndex === 0}
                    onClick={() =>
                      setSelectedId(sections[selectedIndex - 1]?.id)
                    }
                    type="button"
                  >
                    이전 문서
                  </button>
                  <span>
                    {selectedIndex + 1} / {sections.length} 문서
                  </span>
                  <button
                    disabled={selectedIndex >= sections.length - 1}
                    onClick={() =>
                      setSelectedId(sections[selectedIndex + 1]?.id)
                    }
                    type="button"
                  >
                    다음 문서
                  </button>
                </footer>
              </article>
            ) : (
              <p>
                읽을 수 있는 문서를 찾지 못했습니다. Markdown의 제목이 `#`으로
                시작하는지 확인해 주세요.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
