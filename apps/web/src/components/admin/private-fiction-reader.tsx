"use client";

import { MessageSquareText, Settings2 } from "lucide-react";
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
const privateFictionManuscriptCacheKey = "beat-private-fiction-manuscript-v1";

function readCachedPrivateManuscript(): Manuscript | undefined {
  try {
    const raw = window.localStorage.getItem(privateFictionManuscriptCacheKey);
    if (!raw) return undefined;
    const value = JSON.parse(raw) as Partial<Manuscript>;
    if (
      typeof value.etag !== "string" ||
      typeof value.source !== "string" ||
      typeof value.updatedAt !== "string"
    )
      return undefined;
    return value as Manuscript;
  } catch {
    return undefined;
  }
}

function cachePrivateManuscript(manuscript: Manuscript) {
  try {
    window.localStorage.setItem(
      privateFictionManuscriptCacheKey,
      JSON.stringify(manuscript),
    );
  } catch {
    // Keep the server copy readable if browser storage is unavailable or full.
  }
}

function clearCachedPrivateManuscript() {
  try {
    window.localStorage.removeItem(privateFictionManuscriptCacheKey);
  } catch {
    // The server remains the source of truth when browser storage is unavailable.
  }
}

type FictionAnnotation = {
  id: string;
  episode: number;
  blockIndex: number;
  startOffset: number;
  endOffset: number;
  quote: string;
  prefix: string;
  suffix: string;
  comment: string;
  createdAt: string;
};
type FeedbackDocument = {
  etag: string | null;
  annotations: FictionAnnotation[];
  updatedAt: string | null;
};
type PendingFeedback = Omit<FictionAnnotation, "id" | "comment" | "createdAt">;
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

function contentsEntryTitle(section: ManuscriptSection) {
  return section.kind === "episode" && section.episode !== undefined
    ? `${section.episode}화. ${section.title}`
    : section.title;
}

function annotationRange(text: string, annotation: FictionAnnotation) {
  const { startOffset, endOffset, quote } = annotation;
  if (
    startOffset >= 0 &&
    endOffset <= text.length &&
    text.slice(startOffset, endOffset) === quote
  )
    return { start: startOffset, end: endOffset };

  const matches: number[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const index = text.indexOf(quote, cursor);
    if (index < 0) break;
    matches.push(index);
    cursor = index + Math.max(1, quote.length);
  }
  if (!matches.length) return undefined;
  const prefixNeedle = annotation.prefix.slice(-32);
  const suffixNeedle = annotation.suffix.slice(0, 32);
  matches.sort((left, right) => {
    const score = (index: number) =>
      Number(
        Boolean(prefixNeedle) &&
          text.slice(Math.max(0, index - prefixNeedle.length), index) ===
            prefixNeedle,
      ) +
      Number(
        Boolean(suffixNeedle) &&
          text.slice(
            index + quote.length,
            index + quote.length + suffixNeedle.length,
          ) === suffixNeedle,
      );
    return (
      score(right) - score(left) ||
      Math.abs(left - startOffset) - Math.abs(right - startOffset)
    );
  });
  const start = matches[0];
  return start === undefined ? undefined : { start, end: start + quote.length };
}

function annotatedText(
  text: string,
  offset: number,
  ranges: Array<{
    annotation: FictionAnnotation;
    start: number;
    end: number;
  }>,
) {
  if (!ranges.length) return text;

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const range of ranges) {
    const start = Math.max(offset, range.start) - offset;
    const end = Math.min(offset + text.length, range.end) - offset;
    if (start < cursor || start >= text.length || end <= start) continue;
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <mark
        className="private-fiction-highlight"
        data-feedback-highlight={range.annotation.id}
        key={`feedback-${range.annotation.id}-${offset}`}
        title={range.annotation.comment}
      >
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

function inlineMarkdown(
  text: string,
  annotations: FictionAnnotation[] = [],
  blockIndex = -1,
) {
  const pattern =
    /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;
  const segments = text.split(pattern).map((part) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return { display: part.slice(2, -2), kind: "strong" as const };
    if (part.startsWith("*") && part.endsWith("*"))
      return { display: part.slice(1, -1), kind: "em" as const };
    if (part.startsWith("`") && part.endsWith("`"))
      return { display: part.slice(1, -1), kind: "code" as const };
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (link)
      return { display: link[1] ?? "", href: link[2], kind: "link" as const };
    return { display: part, kind: "text" as const };
  });
  const visibleText = segments.map((segment) => segment.display).join("");
  const ranges = annotations
    .filter((annotation) => annotation.blockIndex === blockIndex)
    .map((annotation) => {
      const resolved = annotationRange(visibleText, annotation);
      return resolved ? { annotation, ...resolved } : undefined;
    })
    .filter((range) => range !== undefined)
    .sort((left, right) => left.start - right.start);

  let offset = 0;
  return segments.map((segment, index) => {
    const content = annotatedText(segment.display, offset, ranges);
    offset += segment.display.length;
    if (segment.kind === "strong")
      return <strong key={index}>{content}</strong>;
    if (segment.kind === "em") return <em key={index}>{content}</em>;
    if (segment.kind === "code") return <code key={index}>{content}</code>;
    if (segment.kind === "link")
      return (
        <a href={segment.href} key={index} rel="noreferrer" target="_blank">
          {content}
        </a>
      );
    return <span key={index}>{content}</span>;
  });
}

function MarkdownBlocks({
  source,
  annotations,
}: {
  source: string;
  annotations: FictionAnnotation[];
}) {
  const lines = source.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let quote: string[] = [];
  let code: string[] = [];
  let inCode = false;
  let feedbackBlockIndex = 0;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const blockIndex = feedbackBlockIndex++;
    blocks.push(
      <p data-feedback-block-index={blockIndex} key={`p-${blocks.length}`}>
        {inlineMarkdown(paragraph.join(" "), annotations, blockIndex)}
      </p>,
    );
    paragraph = [];
  };
  const flushList = () => {
    if (!list.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`}>
        {list.map((item, index) => {
          const blockIndex = feedbackBlockIndex++;
          return (
            <li data-feedback-block-index={blockIndex} key={index}>
              {inlineMarkdown(item, annotations, blockIndex)}
            </li>
          );
        })}
      </ul>,
    );
    list = [];
  };
  const flushQuote = () => {
    if (!quote.length) return;
    blocks.push(
      <blockquote key={`quote-${blocks.length}`}>
        {quote.map((line, index) => {
          const blockIndex = feedbackBlockIndex++;
          return (
            <p data-feedback-block-index={blockIndex} key={index}>
              {inlineMarkdown(line, annotations, blockIndex)}
            </p>
          );
        })}
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
      const blockIndex = feedbackBlockIndex++;
      blocks.push(
        <Heading
          data-feedback-block-index={blockIndex}
          key={`h-${blocks.length}`}
        >
          {inlineMarkdown(heading[2] ?? "", annotations, blockIndex)}
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

function selectionAnchor(
  root: HTMLElement,
  episode: number,
): PendingFeedback | undefined {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  const blockFor = (node: Node) => {
    const element =
      node.nodeType === Node.ELEMENT_NODE
        ? (node as Element)
        : node.parentElement;
    return element?.closest<HTMLElement>("[data-feedback-block-index]");
  };
  const startBlock = blockFor(range.startContainer);
  const endBlock = blockFor(range.endContainer);
  if (!startBlock || startBlock !== endBlock || !root.contains(startBlock))
    return;

  const quote = range.toString();
  if (!quote.trim() || quote.length > 2_000) return;
  const before = range.cloneRange();
  before.selectNodeContents(startBlock);
  before.setEnd(range.startContainer, range.startOffset);
  const startOffset = before.toString().length;
  const endOffset = startOffset + quote.length;
  const blockText = startBlock.textContent ?? "";
  if (blockText.slice(startOffset, endOffset) !== quote) return;

  return {
    episode,
    blockIndex: Number(startBlock.dataset.feedbackBlockIndex),
    startOffset,
    endOffset,
    quote,
    prefix: blockText.slice(Math.max(0, startOffset - 100), startOffset),
    suffix: blockText.slice(endOffset, endOffset + 100),
  };
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
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackDocument, setFeedbackDocument] = useState<FeedbackDocument>({
    etag: null,
    annotations: [],
    updatedAt: null,
  });
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState(
    "문장을 선택해 의견을 남길 수 있습니다.",
  );
  const [pendingFeedback, setPendingFeedback] = useState<PendingFeedback>();
  const [feedbackComment, setFeedbackComment] = useState("");
  const [preferences, setPreferences] = useState(defaultReaderPreferences);
  const dialog = useRef<HTMLDialogElement>(null);
  const sectionPositionOverride = useRef<
    { sectionId: string; position: "start" | "end" } | undefined
  >(undefined);

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
    const cached = readCachedPrivateManuscript();
    if (cached) {
      setManuscript(cached);
      setAuthenticated(true);
      setMessage(
        "이 기기에 저장된 원고를 표시하며 최신본을 확인하고 있습니다.",
      );
    }
    setBusy(true);
    try {
      const response = await authorizedBeatAdminRequest(
        "/admin/private-fiction",
        { cache: "no-store" },
      );
      if (response.status === 401) {
        setAuthenticated(false);
        setManuscript(undefined);
        clearCachedPrivateManuscript();
        setMessage("로그인이 만료되었습니다. 다시 로그인해 주세요.");
        return;
      }
      if (response.status === 404) {
        setAuthenticated(true);
        setMessage(
          "아직 보관된 원고가 없습니다. 로컬 파일을 선택해 처음 저장할 수 있습니다.",
        );
        setManuscript(undefined);
        clearCachedPrivateManuscript();
        return;
      }
      if (!response.ok) throw new Error("비공개 원고를 불러오지 못했습니다.");
      const latest = (await response.json()) as Manuscript;
      cachePrivateManuscript(latest);
      setManuscript(latest);
      setAuthenticated(true);
      setMessage("최신 원고를 불러와 이 기기에 저장했습니다.");
    } catch (error) {
      if (cached && hasPersistentBeatAdminSession()) {
        setAuthenticated(true);
        setMessage(
          "서버에 연결하지 못해 이 기기에 저장된 원고를 표시하고 있습니다.",
        );
      } else {
        setAuthenticated(false);
        setMessage(
          error instanceof Error
            ? error.message
            : "원고를 불러오지 못했습니다.",
        );
      }
    } finally {
      setBusy(false);
    }
  }, []);

  const refreshFeedback = useCallback(async () => {
    if (!hasPersistentBeatAdminSession()) return;
    setFeedbackBusy(true);
    try {
      const response = await authorizedBeatAdminRequest(
        "/admin/private-fiction/annotations",
        { cache: "no-store" },
      );
      if (response.status === 401) {
        setAuthenticated(false);
        setFeedbackMessage("로그인이 만료되었습니다. 다시 로그인해 주세요.");
        return;
      }
      if (!response.ok) throw new Error("피드백을 불러오지 못했습니다.");
      setFeedbackDocument((await response.json()) as FeedbackDocument);
      setFeedbackMessage("이 회차의 저장된 피드백을 불러왔습니다.");
    } catch (error) {
      setFeedbackMessage(
        error instanceof Error
          ? error.message
          : "피드백을 불러오지 못했습니다.",
      );
    } finally {
      setFeedbackBusy(false);
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

  useEffect(() => {
    if (authenticated) void refreshFeedback();
  }, [authenticated, refreshFeedback]);

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
  const initialPositionOverride =
    selected && sectionPositionOverride.current?.sectionId === selected.id
      ? sectionPositionOverride.current.position
      : "saved";
  const clearInitialPositionOverride = useCallback(() => {
    if (sectionPositionOverride.current?.sectionId === selected?.id)
      sectionPositionOverride.current = undefined;
  }, [selected?.id]);

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
    if (selected && isEpisodeRoute) {
      window.localStorage.setItem("private-fiction-book-section", selected.id);
    }
  }, [isEpisodeRoute, selected]);

  useEffect(() => {
    if (!selected?.id) return;
    setPendingFeedback(undefined);
    setFeedbackComment("");
  }, [selected?.id]);

  const selectedOrderIndex = selected
    ? readingOrder.findIndex((section) => section.id === selected.id)
    : -1;
  const nextSection = readingOrder[selectedOrderIndex + 1];
  const selectedFeedback = selected?.episode
    ? feedbackDocument.annotations.filter(
        (annotation) => annotation.episode === selected.episode,
      )
    : [];

  function beginFeedbackSelection(root: HTMLElement) {
    if (!selected?.episode) return;
    const anchor = selectionAnchor(root, selected.episode);
    if (anchor) {
      setPendingFeedback(anchor);
      setFeedbackComment("");
      setFeedbackMessage("선택한 문장에 코멘트를 작성해 주세요.");
      return;
    }
    if (window.getSelection()?.toString().trim())
      setFeedbackMessage("한 문단 안에서 의견을 남길 문장을 선택해 주세요.");
  }

  const chooseSection = (
    id: string,
    position: "start" | "end" | "saved" = "saved",
  ) => {
    const section = sections.find((item) => item.id === id);
    let previousSection = selected;
    if (!isEpisodeRoute) {
      try {
        const lastReadId = window.localStorage.getItem(
          "private-fiction-book-section",
        );
        previousSection =
          readingOrder.find((item) => item.id === lastReadId) ?? selected;
      } catch {
        // Selecting a section remains available when browser storage is disabled.
      }
    }
    const selectingNextEpisode =
      section?.kind === "episode" &&
      section.episode !== undefined &&
      previousSection?.kind === "episode" &&
      previousSection.episode !== undefined &&
      section.episode === previousSection.episode + 1;
    const destinationPosition =
      position === "saved" && selectingNextEpisode ? "start" : position;
    // The explicit override still works if localStorage cannot save the reset.
    if (section && destinationPosition !== "saved") {
      sectionPositionOverride.current = {
        sectionId: section.id,
        position: destinationPosition,
      };
    } else {
      sectionPositionOverride.current = undefined;
    }
    if (destinationPosition !== "saved" && section) {
      const positionKey =
        section.kind === "episode" && section.episode
          ? `private-fiction-episode-${section.episode}`
          : section.id;
      try {
        localStorage.setItem(
          `beat-fiction-v1-book-position-${positionKey}`,
          destinationPosition === "end" ? "1" : "0",
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
    setFeedbackOpen(false);
    dialog.current?.showModal();
  }

  function showReaderSettings() {
    setTocOpen(false);
    setSettingsOpen(true);
    setFeedbackOpen(false);
    dialog.current?.showModal();
  }

  function showFeedback() {
    setTocOpen(false);
    setSettingsOpen(false);
    setFeedbackOpen(true);
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
      const updated = { ...saved, source };
      cachePrivateManuscript(updated);
      setManuscript(updated);
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

  async function persistFeedback(annotations: FictionAnnotation[]) {
    setFeedbackBusy(true);
    try {
      const response = await authorizedBeatAdminRequest(
        "/admin/private-fiction/annotations",
        {
          body: JSON.stringify({
            expectedEtag: feedbackDocument.etag,
            annotations,
          }),
          method: "PUT",
        },
      );
      if (response.status === 409) {
        setFeedbackMessage(
          "다른 탭에서 피드백이 바뀌었습니다. 목록을 새로 불러온 뒤 다시 저장해 주세요.",
        );
        void refreshFeedback();
        return false;
      }
      if (!response.ok) throw new Error("피드백을 저장하지 못했습니다.");
      setFeedbackDocument((await response.json()) as FeedbackDocument);
      setFeedbackMessage("피드백을 비공개로 저장했습니다.");
      return true;
    } catch (error) {
      setFeedbackMessage(
        error instanceof Error ? error.message : "피드백 저장에 실패했습니다.",
      );
      return false;
    } finally {
      setFeedbackBusy(false);
    }
  }

  async function savePendingFeedback() {
    if (!pendingFeedback) return;
    const comment = feedbackComment.trim();
    if (!comment) {
      setFeedbackMessage("코멘트를 입력해 주세요.");
      return;
    }
    const saved = await persistFeedback([
      ...feedbackDocument.annotations,
      {
        ...pendingFeedback,
        id: crypto.randomUUID(),
        comment,
        createdAt: new Date().toISOString(),
      },
    ]);
    if (saved) {
      setPendingFeedback(undefined);
      setFeedbackComment("");
      window.getSelection()?.removeAllRanges();
    }
  }

  async function deleteFeedback(annotationId: string) {
    await persistFeedback(
      feedbackDocument.annotations.filter(
        (annotation) => annotation.id !== annotationId,
      ),
    );
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
                    {contentsEntryTitle(section)}
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
                  onClick={() => chooseSection(episodes[0]!.id, "start")}
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
        key={selected.id}
        initialPosition={initialPositionOverride}
        label="소설 본문. 화면 좌우를 누르거나 밀어 페이지를 넘기세요. Enter 키를 누르면 메뉴가 열립니다."
        layoutKey={`${selected.id}:${preferences.size}:${preferences.line}:${preferences.font}`}
        onInitialPositionApplied={clearInitialPositionOverride}
        onBoundaryTurn={(delta) => {
          const target = readingOrder[selectedOrderIndex + delta];
          if (target) chooseSection(target.id, delta < 0 ? "end" : "start");
        }}
        positionKey={
          selected.kind === "episode" && selected.episode
            ? `private-fiction-episode-${selected.episode}`
            : selected.id
        }
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
              <section
                aria-label={`${episodeLabel} 본문`}
                className="book-article-body"
                onKeyUp={(event) => beginFeedbackSelection(event.currentTarget)}
                onMouseUp={(event) =>
                  beginFeedbackSelection(event.currentTarget)
                }
              >
                <MarkdownBlocks
                  annotations={selectedFeedback}
                  source={selected.content}
                />
              </section>
              <div className="book-end">
                {nextSection ? (
                  <button
                    className="private-fiction-next-episode"
                    onClick={() => chooseSection(nextSection.id, "start")}
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
                aria-label={`회차 피드백 ${selectedFeedback.length}개`}
                onClick={() => {
                  setControlsVisible(false);
                  showFeedback();
                }}
              >
                <MessageSquareText size={18} />
              </button>
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
      {pendingFeedback ? (
        <section
          className="private-fiction-feedback-composer"
          aria-label="선택한 원고에 의견 남기기"
        >
          <p className="private-fiction-feedback-heading">
            {pendingFeedback.episode}화에서 선택한 부분
          </p>
          <blockquote>{pendingFeedback.quote}</blockquote>
          <label>
            <span>코멘트</span>
            <textarea
              maxLength={5_000}
              onChange={(event) =>
                setFeedbackComment(event.currentTarget.value)
              }
              value={feedbackComment}
            />
          </label>
          <p className="private-fiction-feedback-status" role="status">
            {feedbackMessage}
          </p>
          <div>
            <button
              disabled={feedbackBusy || !feedbackComment.trim()}
              onClick={() => void savePendingFeedback()}
              type="button"
            >
              피드백 저장
            </button>
            <button
              disabled={feedbackBusy}
              onClick={() => {
                setPendingFeedback(undefined);
                setFeedbackComment("");
                window.getSelection()?.removeAllRanges();
              }}
              type="button"
            >
              취소
            </button>
          </div>
        </section>
      ) : null}
      <dialog
        ref={dialog}
        className="viewer-dialog private-fiction-contents-dialog"
        onClose={() => {
          setTocOpen(false);
          setSettingsOpen(false);
          setFeedbackOpen(false);
        }}
      >
        <header>
          <h2>
            {settingsOpen
              ? "읽기 설정"
              : feedbackOpen
                ? "회차 피드백"
                : tocOpen
                  ? "목차"
                  : "비공개 원고"}
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
        ) : feedbackOpen ? (
          <section className="private-fiction-feedback-list">
            <p className="private-fiction-dialog-status" role="status">
              {feedbackMessage}
            </p>
            {selectedFeedback.length ? (
              <ol>
                {selectedFeedback.map((annotation) => (
                  <li key={annotation.id}>
                    <blockquote>{annotation.quote}</blockquote>
                    <p>{annotation.comment}</p>
                    <time dateTime={annotation.createdAt}>
                      {new Date(annotation.createdAt).toLocaleString("ko-KR")}
                    </time>
                    <button
                      disabled={feedbackBusy}
                      onClick={() => void deleteFeedback(annotation.id)}
                      type="button"
                    >
                      삭제
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p>
                이 회차에는 아직 남긴 피드백이 없습니다. 본문에서 문장을
                드래그하거나 길게 눌러 선택하면 코멘트를 남길 수 있습니다.
              </p>
            )}
            <button
              disabled={feedbackBusy}
              onClick={() => void refreshFeedback()}
              type="button"
            >
              피드백 새로고침
            </button>
          </section>
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
                    {contentsEntryTitle(section)}
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
