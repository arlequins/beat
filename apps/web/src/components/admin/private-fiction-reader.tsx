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

type Manuscript = {
  etag: string;
  source: string;
  updatedAt: string;
  workId?: string;
  workTitle?: string;
  editionId?: string;
};
type PrivateFictionWork = {
  id: string;
  title: string;
  activeEditionId: string;
  editions: Array<{ id: string; label: string }>;
  allowedSubjects: string[];
  createdAt: string;
  updatedAt: string;
};
type PrivateFictionCatalog = {
  etag: string | null;
  works: PrivateFictionWork[];
};
const privateFictionManuscriptCacheKey = (workId: string, editionId: string) =>
  `beat-private-fiction-manuscript-v2-${workId}-${editionId}`;

function readCachedPrivateManuscript(
  workId: string,
  editionId: string,
): Manuscript | undefined {
  try {
    const raw =
      window.localStorage.getItem(
        privateFictionManuscriptCacheKey(workId, editionId),
      ) ??
      (workId === "reality-error" && editionId === "current"
        ? window.localStorage.getItem("beat-private-fiction-manuscript-v1")
        : null);
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

function cachePrivateManuscript(
  manuscript: Manuscript,
  workId: string,
  editionId: string,
) {
  try {
    window.localStorage.setItem(
      privateFictionManuscriptCacheKey(workId, editionId),
      JSON.stringify(manuscript),
    );
  } catch {
    // Keep the server copy readable if browser storage is unavailable or full.
  }
}

function clearCachedPrivateManuscript(workId: string, editionId: string) {
  try {
    window.localStorage.removeItem(
      privateFictionManuscriptCacheKey(workId, editionId),
    );
    if (workId === "reality-error" && editionId === "current")
      window.localStorage.removeItem("beat-private-fiction-manuscript-v1");
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
type FeedbackAnchor = Omit<FictionAnnotation, "id" | "comment" | "createdAt">;
type PendingFeedback = {
  episode: number;
  quote: string;
  anchors: FeedbackAnchor[];
};
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
  let arcTitle = "";
  let arcPart = 0;

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

    const episodeMatch = title.match(/^(\d+)\s*화(?:\s*[.．—–:-]\s*(.+))?$/);
    const kind = title.includes("설정집")
      ? "guide"
      : episodeMatch
        ? "episode"
        : "document";
    let sectionTitle = title.replace(/^《현실 오류》\s*/, "");
    if (episodeMatch) {
      const explicitTitle = episodeMatch[2]?.trim();
      const numberedTitle = explicitTitle?.match(/^(.+?)\s+(?:-\s*)?(\d+)$/);
      const coverTitle = content.includes("<!-- PAGE_BREAK -->")
        ? content
            .split("<!-- PAGE_BREAK -->")[0]
            ?.match(/^##\s+(.+)$/m)?.[1]
            ?.trim()
        : undefined;
      if (numberedTitle) {
        arcTitle = numberedTitle[1]!.trim();
        arcPart = Number(numberedTitle[2]);
      } else if (explicitTitle || coverTitle) {
        arcTitle = explicitTitle ?? coverTitle!;
        arcPart = 1;
      } else {
        arcPart += 1;
      }
      sectionTitle = arcTitle ? `${arcTitle} - ${arcPart}` : "";
    }
    sections.push({
      id: `section-${sections.length + 1}`,
      title: sectionTitle,
      content,
      ...(episodeMatch ? { episode: Number(episodeMatch[1]) } : {}),
      kind,
    });
  }

  return { introduction, sections };
}

function contentsEntryTitle(section: ManuscriptSection) {
  return section.kind === "episode" && section.episode !== undefined
    ? section.title
      ? `${section.episode}화. ${section.title}`
      : `${section.episode}화`
    : section.title;
}

function workUrl(workId: string, editionId: string, list = false) {
  const params = new URLSearchParams();
  if (!list || workId !== "reality-error") params.set("work", workId);
  if (workId !== "reality-error" || editionId !== "current")
    params.set("edition", editionId);
  const query = params.toString();
  return `/private/fictions/${list ? "list/" : ""}${query ? `?${query}` : ""}`;
}

function sectionStorageKey(workId: string, editionId: string) {
  return workId === "reality-error" && editionId === "current"
    ? "private-fiction-book-section"
    : `private-fiction-${workId}-${editionId}-book-section`;
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
    if (line.trim() === "<!-- PAGE_BREAK -->") {
      flushTextBlocks();
      blocks.push(
        <div
          aria-hidden="true"
          className="private-fiction-page-break"
          key={`page-break-${blocks.length}`}
        />,
      );
      continue;
    }
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
  if (
    !root.contains(range.startContainer) ||
    !root.contains(range.endContainer)
  )
    return;
  const anchors: FeedbackAnchor[] = [];
  for (const block of root.querySelectorAll<HTMLElement>(
    "[data-feedback-block-index]",
  )) {
    if (!range.intersectsNode(block)) continue;
    const clipped = document.createRange();
    clipped.selectNodeContents(block);
    if (clipped.compareBoundaryPoints(Range.START_TO_START, range) < 0)
      clipped.setStart(range.startContainer, range.startOffset);
    if (clipped.compareBoundaryPoints(Range.END_TO_END, range) > 0)
      clipped.setEnd(range.endContainer, range.endOffset);
    const quote = clipped.toString();
    if (!quote.trim()) continue;
    const before = document.createRange();
    before.selectNodeContents(block);
    before.setEnd(clipped.startContainer, clipped.startOffset);
    const startOffset = before.toString().length;
    const endOffset = startOffset + quote.length;
    const blockText = block.textContent ?? "";
    if (blockText.slice(startOffset, endOffset) !== quote) return;
    anchors.push({
      episode,
      blockIndex: Number(block.dataset.feedbackBlockIndex),
      startOffset,
      endOffset,
      quote,
      prefix: blockText.slice(Math.max(0, startOffset - 100), startOffset),
      suffix: blockText.slice(endOffset, endOffset + 100),
    });
  }
  const quote = anchors.map((anchor) => anchor.quote).join("\n\n");
  if (!anchors.length || quote.length > 2_000) return;
  return { episode, quote, anchors };
}

export function PrivateFictionReader() {
  const params = useSearchParams();
  return (
    <ScopedPrivateFictionReader
      key={`${params.get("work") ?? "reality-error"}:${params.get("edition") ?? "active"}`}
    />
  );
}

function ScopedPrivateFictionReader() {
  const pathname = usePathname() ?? "/private/fictions/";
  const router = useRouter();
  const searchParams = useSearchParams();
  const routePart = pathname
    .replace(/^.*\/private\/fictions\/?/, "")
    .replace(/\/+$/, "");
  const requestedEpisode = searchParams.get("episode");
  const requestedWorkId = searchParams.get("work");
  const requestedEditionId = searchParams.get("edition");
  const requestedPosition = searchParams.get("position");
  const routePositionOverride =
    requestedPosition === "start" || requestedPosition === "end"
      ? requestedPosition
      : undefined;
  const routeEpisode = requestedEpisode ? Number(requestedEpisode) : undefined;
  const isEpisodeRoute = routeEpisode !== undefined;
  const isListRoute = routePart === "list";
  const isCatalogRoute = !isEpisodeRoute && !isListRoute && !requestedWorkId;
  const workId = requestedWorkId ?? "reality-error";
  const [catalog, setCatalog] = useState<PrivateFictionCatalog>({
    etag: null,
    works: [],
  });
  const [editionId, setEditionId] = useState(requestedEditionId ?? "current");
  const [newWorkTitle, setNewWorkTitle] = useState("");
  const [newWorkFile, setNewWorkFile] = useState<File>();
  const [newEditionLabel, setNewEditionLabel] = useState("");
  const [newEditionFile, setNewEditionFile] = useState<File>();
  const [authenticated, setAuthenticated] = useState(false);
  const [manuscript, setManuscript] = useState<Manuscript>();
  const [lastReadSectionId, setLastReadSectionId] = useState<string>();
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
  const [selectionPreview, setSelectionPreview] = useState<PendingFeedback>();
  const [selectionMode, setSelectionMode] = useState(false);
  const [readingReset, setReadingReset] = useState(0);
  const bodyRef = useRef<HTMLElement>(null);
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
    const cachedWorkId = requestedWorkId ?? "reality-error";
    const cachedEditionId = requestedEditionId ?? "current";
    const cached = readCachedPrivateManuscript(cachedWorkId, cachedEditionId);
    if (cached) {
      setManuscript(cached);
      setAuthenticated(true);
      setMessage(
        "이 기기에 저장된 원고를 표시하며 최신본을 확인하고 있습니다.",
      );
    }
    setBusy(true);
    try {
      const catalogResponse = await authorizedBeatAdminRequest(
        "/admin/private-fictions",
        { cache: "no-store" },
      );
      if (catalogResponse.status === 401) {
        setAuthenticated(false);
        setManuscript(undefined);
        clearCachedPrivateManuscript(cachedWorkId, cachedEditionId);
        setMessage("로그인이 만료되었습니다. 다시 로그인해 주세요.");
        return;
      }
      if (!catalogResponse.ok)
        throw new Error("비공개 작품 목록을 불러오지 못했습니다.");
      const latestCatalog =
        (await catalogResponse.json()) as PrivateFictionCatalog;
      setCatalog(latestCatalog);
      if (isCatalogRoute) {
        setAuthenticated(true);
        setManuscript(undefined);
        setMessage("읽을 작품을 선택해 주세요.");
        return;
      }
      const requestedWork = latestCatalog.works.find(
        (work) => work.id === cachedWorkId,
      );
      const selectedWork =
        requestedWork ??
        (!requestedWorkId ? latestCatalog.works[0] : undefined);
      if (!selectedWork) {
        setAuthenticated(true);
        setManuscript(undefined);
        setMessage("아직 보관된 작품이 없습니다. 새 작품을 추가해 주세요.");
        return;
      }
      const selectedEditionId =
        requestedEditionId ?? selectedWork.activeEditionId;
      setEditionId(selectedEditionId);
      const response = await authorizedBeatAdminRequest(
        `/admin/private-fictions/${encodeURIComponent(selectedWork.id)}/editions/${encodeURIComponent(selectedEditionId)}`,
        { cache: "no-store" },
      );
      if (response.status === 401) {
        setAuthenticated(false);
        setManuscript(undefined);
        clearCachedPrivateManuscript(selectedWork.id, selectedEditionId);
        setMessage("로그인이 만료되었습니다. 다시 로그인해 주세요.");
        return;
      }
      if (response.status === 404) {
        setAuthenticated(true);
        setMessage(
          "이 작품 판본에는 아직 저장된 원고가 없습니다. 작품 목차에서 Markdown을 저장해 주세요.",
        );
        setManuscript(undefined);
        return;
      }
      if (!response.ok) throw new Error("비공개 원고를 불러오지 못했습니다.");
      const latest = (await response.json()) as Manuscript;
      const loaded = {
        ...latest,
        workId: selectedWork.id,
        workTitle: selectedWork.title,
        editionId: selectedEditionId,
      };
      cachePrivateManuscript(loaded, selectedWork.id, selectedEditionId);
      setManuscript(loaded);
      setAuthenticated(true);
      setMessage("최신 원고를 불러와 이 기기에 저장했습니다.");
    } catch (error) {
      if (cached && hasPersistentBeatAdminSession()) {
        setAuthenticated(true);
        setMessage(
          "서버에 연결하지 못해 이 기기에 저장된 작품 판본을 표시하고 있습니다.",
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
  }, [requestedWorkId, requestedEditionId, isCatalogRoute]);

  const refreshFeedback = useCallback(async () => {
    if (!hasPersistentBeatAdminSession()) return;
    setFeedbackBusy(true);
    try {
      const response = await authorizedBeatAdminRequest(
        `/admin/private-fictions/${encodeURIComponent(workId)}/editions/${encodeURIComponent(editionId)}/annotations`,
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
  }, [workId, editionId]);

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
    if (authenticated && manuscript && !isCatalogRoute) void refreshFeedback();
  }, [authenticated, manuscript, isCatalogRoute, refreshFeedback]);

  const parsed = useMemo(
    () => (manuscript ? parseManuscript(manuscript.source) : undefined),
    [manuscript],
  );
  const sections = parsed?.sections ?? [];
  const readingOrder = sections.filter(
    (section) => section.kind === "guide" || section.kind === "episode",
  );
  const episodes = readingOrder.filter((section) => section.kind === "episode");
  const lastReadSection = episodes.find(
    (section) => section.id === lastReadSectionId,
  );
  const routedSection = readingOrder.find(
    (section) => section.kind === "episode" && section.episode === routeEpisode,
  );
  const selected = isEpisodeRoute
    ? routedSection
    : (sections.find((section) => section.id === selectedId) ??
      episodes[0] ??
      readingOrder[0]);
  const initialPositionOverride =
    selected && sectionPositionOverride.current?.sectionId === selected.id
      ? sectionPositionOverride.current.position
      : routePositionOverride && selected?.episode === routeEpisode
        ? routePositionOverride
        : "saved";
  const clearInitialPositionOverride = useCallback(() => {
    if (sectionPositionOverride.current?.sectionId === selected?.id)
      sectionPositionOverride.current = undefined;
    if (!routePositionOverride || selected?.episode !== routeEpisode) return;
    const nextQuery = new URLSearchParams(window.location.search);
    if (nextQuery.get("episode") !== String(routeEpisode)) return;
    if (nextQuery.get("position") !== routePositionOverride) return;
    nextQuery.delete("position");
    const query = nextQuery.toString();
    window.history.replaceState(
      null,
      "",
      query ? `${window.location.pathname}?${query}` : window.location.pathname,
    );
  }, [routeEpisode, routePositionOverride, selected?.episode, selected?.id]);

  useEffect(() => {
    if (isEpisodeRoute || isListRoute) return;
    if (!readingOrder.length) return;
    const savedId = window.localStorage.getItem(
      sectionStorageKey(workId, editionId),
    );
    const savedSection = readingOrder.find((section) => section.id === savedId);
    if (!selectedId || !sections.some((section) => section.id === selectedId)) {
      setSelectedId(
        savedSection?.id ??
          readingOrder.find((section) => section.kind === "episode")?.id ??
          readingOrder[0]?.id,
      );
    }
  }, [
    editionId,
    isEpisodeRoute,
    isListRoute,
    readingOrder,
    sections,
    selectedId,
    workId,
  ]);

  useEffect(() => {
    if (isEpisodeRoute && selected?.kind === "episode") {
      try {
        window.localStorage.setItem(
          sectionStorageKey(workId, editionId),
          selected.id,
        );
      } catch {
        // The current episode remains available when browser storage is disabled.
      }
      setLastReadSectionId(selected.id);
      return;
    }
    if (isListRoute) return;
    try {
      setLastReadSectionId(
        window.localStorage.getItem(sectionStorageKey(workId, editionId)) ??
          undefined,
      );
    } catch {
      setLastReadSectionId(undefined);
    }
  }, [
    editionId,
    isEpisodeRoute,
    isListRoute,
    selected?.id,
    selected?.kind,
    workId,
  ]);

  useEffect(() => {
    if (!selected?.id) return;
    setPendingFeedback(undefined);
    setSelectionPreview(undefined);
    setFeedbackComment("");
    setSelectionMode(false);
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
  // Anchors saved in one operation share a timestamp and comment. Keep their
  // individual offsets for highlighting, but present one review to the reader.
  const feedbackGroups = Array.from(
    selectedFeedback
      .reduce((groups, annotation) => {
        const key = JSON.stringify([annotation.createdAt, annotation.comment]);
        const group = groups.get(key);
        if (group) {
          group.ids.push(annotation.id);
          group.quote += `\n\n${annotation.quote}`;
        } else {
          groups.set(key, { ...annotation, ids: [annotation.id] });
        }
        return groups;
      }, new Map<string, FictionAnnotation & { ids: string[] }>())
      .values(),
  );

  const beginFeedbackSelection = useCallback(
    (root: HTMLElement) => {
      if (!selected?.episode || pendingFeedback) return;
      const anchor = selectionAnchor(root, selected.episode);
      if (anchor) {
        setSelectionPreview((current) =>
          current?.quote === anchor.quote &&
          JSON.stringify(current.anchors) === JSON.stringify(anchor.anchors)
            ? current
            : anchor,
        );
        setFeedbackMessage("선택한 문장에 코멘트를 작성해 주세요.");
        return;
      }
      setSelectionPreview(undefined);
      if (window.getSelection()?.toString().trim())
        setFeedbackMessage("본문에서 2,000자 이내의 부분을 선택해 주세요.");
    },
    [selected?.episode, pendingFeedback],
  );

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const capture = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (bodyRef.current) beginFeedbackSelection(bodyRef.current);
      }, 180);
    };
    document.addEventListener("selectionchange", capture);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("selectionchange", capture);
    };
  }, [beginFeedbackSelection]);

  function resetReadingHistory() {
    if (
      !window.confirm(
        "이 기기의 읽은 기록을 모두 초기화할까요? 로그인, 원고, 피드백과 읽기 설정은 유지됩니다.",
      )
    )
      return;
    try {
      const keys = Object.keys(localStorage).filter(
        (key) =>
          key.startsWith("beat-fiction-v1-book-position-") ||
          key === "private-fiction-book-section" ||
          (key.startsWith("private-fiction-") &&
            key.endsWith("-book-section")) ||
          key === "beat-fiction-v1-last",
      );
      for (const key of keys) localStorage.removeItem(key);
      setLastReadSectionId(undefined);
      setSelectedId(undefined);
      setReadingReset((value) => value + 1);
      setMessage("이 기기의 읽은 기록을 모두 초기화했습니다.");
      dialog.current?.close();
      if (isEpisodeRoute) router.push("/private/fictions/", { scroll: false });
    } catch {
      setMessage(
        "읽은 기록을 초기화하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.",
      );
    }
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
          sectionStorageKey(workId, editionId),
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
          ? workId === "reality-error" && editionId === "current"
            ? `private-fiction-episode-${section.episode}`
            : `private-fiction-${workId}-${editionId}-episode-${section.episode}`
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
      const destination = new URLSearchParams({
        episode: String(section.episode),
      });
      if (workId !== "reality-error") destination.set("work", workId);
      if (workId !== "reality-error" || editionId !== "current")
        destination.set("edition", editionId);
      if (destinationPosition !== "saved")
        destination.set("position", destinationPosition);
      // Keep the loaded reader and scroll position while changing static-hosted URLs.
      const readerPath = window.location.pathname.replace(
        /\/private\/fictions(?:\/list)?\/?$/,
        "/private/fictions/",
      );
      window.history.pushState(
        null,
        "",
        `${readerPath}?${destination.toString()}`,
      );
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
        `/admin/private-fictions/${encodeURIComponent(workId)}/editions/${encodeURIComponent(editionId)}`,
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
      const updated = {
        ...saved,
        source,
        workId,
        editionId,
        workTitle: catalog.works.find((work) => work.id === workId)?.title,
      };
      cachePrivateManuscript(updated, workId, editionId);
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

  async function createWork(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newWorkTitle.trim() || !newWorkFile) {
      setMessage("작품 제목과 Markdown 원고를 선택해 주세요.");
      return;
    }
    setBusy(true);
    try {
      const source = await newWorkFile.text();
      const id = `work-${crypto.randomUUID().slice(0, 8)}`;
      const response = await authorizedBeatAdminRequest(
        "/admin/private-fictions",
        {
          body: JSON.stringify({
            expectedCatalogEtag: catalog.etag,
            id,
            title: newWorkTitle.trim(),
            editionId: "first",
            editionLabel: "초판",
            source,
          }),
          method: "POST",
        },
      );
      if (response.status === 409)
        throw new Error(
          "작품 목록이 바뀌었습니다. 새로고침한 뒤 다시 저장해 주세요.",
        );
      if (!response.ok) throw new Error("새 작품을 저장하지 못했습니다.");
      const created = (await response.json()) as {
        work: PrivateFictionWork;
        catalogEtag: string;
        etag: string;
        updatedAt: string;
      };
      setCatalog((current) => ({
        etag: created.catalogEtag,
        works: [...current.works, created.work],
      }));
      cachePrivateManuscript(
        {
          etag: created.etag,
          updatedAt: created.updatedAt,
          source,
          workId: id,
          workTitle: created.work.title,
          editionId: "first",
        },
        id,
        "first",
      );
      setNewWorkTitle("");
      setNewWorkFile(undefined);
      setMessage("새 작품을 소유자 전용 보관함에 추가했습니다.");
      router.push(workUrl(id, "first"), { scroll: false });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "새 작품 저장에 실패했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function createEdition(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeWork || !newEditionLabel.trim() || !newEditionFile) {
      setMessage("판본 이름과 Markdown 원고를 선택해 주세요.");
      return;
    }
    setBusy(true);
    try {
      const source = await newEditionFile.text();
      const id = `edition-${crypto.randomUUID().slice(0, 8)}`;
      const response = await authorizedBeatAdminRequest(
        `/admin/private-fictions/${encodeURIComponent(workId)}/editions`,
        {
          body: JSON.stringify({
            expectedCatalogEtag: catalog.etag,
            id,
            label: newEditionLabel.trim(),
            source,
          }),
          method: "POST",
        },
      );
      if (response.status === 409)
        throw new Error(
          "작품 목록이 바뀌었습니다. 새로고침한 뒤 다시 저장해 주세요.",
        );
      if (!response.ok) throw new Error("새 판본을 저장하지 못했습니다.");
      const created = (await response.json()) as {
        work: PrivateFictionWork;
        catalogEtag: string;
        etag: string;
        updatedAt: string;
      };
      setCatalog((current) => ({
        etag: created.catalogEtag,
        works: current.works.map((work) =>
          work.id === workId ? created.work : work,
        ),
      }));
      cachePrivateManuscript(
        {
          etag: created.etag,
          updatedAt: created.updatedAt,
          source,
          workId,
          workTitle: activeWork.title,
          editionId: id,
        },
        workId,
        id,
      );
      setNewEditionLabel("");
      setNewEditionFile(undefined);
      setMessage("새 판본을 작품에 추가했습니다.");
      router.push(workUrl(workId, id), { scroll: false });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "새 판본 저장에 실패했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function persistFeedback(annotations: FictionAnnotation[]) {
    setFeedbackBusy(true);
    try {
      const response = await authorizedBeatAdminRequest(
        `/admin/private-fictions/${encodeURIComponent(workId)}/editions/${encodeURIComponent(editionId)}/annotations`,
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
    const createdAt = new Date().toISOString();
    const saved = await persistFeedback([
      ...feedbackDocument.annotations,
      ...pendingFeedback.anchors.map((anchor) => ({
        ...anchor,
        id: crypto.randomUUID(),
        comment,
        createdAt,
      })),
    ]);
    if (saved) {
      setPendingFeedback(undefined);
      setFeedbackComment("");
      window.getSelection()?.removeAllRanges();
    }
  }

  async function deleteFeedback(annotationIds: string[]) {
    await persistFeedback(
      feedbackDocument.annotations.filter(
        (annotation) => !annotationIds.includes(annotation.id),
      ),
    );
  }

  const activeWork = catalog.works.find((work) => work.id === workId);
  const viewerContent = authenticated && manuscript && parsed && selected;
  if (!authenticated) {
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

  if (isCatalogRoute) {
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
          <button disabled={busy} onClick={() => void load()} type="button">
            새로고침
          </button>
          <button onClick={resetReadingHistory} type="button">
            읽은 기록 전부 리셋하기
          </button>
        </header>
        <div className="private-fiction-library">
          {catalog.works.length ? (
            <ul className="private-fiction-work-list">
              {catalog.works.map((work) => (
                <li className="private-fiction-work-card" key={work.id}>
                  <div>
                    <p className="private-fiction-eyebrow">비공개 작품</p>
                    <h2>{work.title}</h2>
                  </div>
                  <div className="private-fiction-library-actions">
                    <Link href={workUrl(work.id, work.activeEditionId, true)}>
                      작품 목차
                    </Link>
                    <Link href={workUrl(work.id, work.activeEditionId)}>
                      작품 열기
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              아직 보관된 작품이 없습니다. 아래에서 첫 작품을 추가할 수
              있습니다.
            </p>
          )}
          <form
            className="private-fiction-new-work"
            onSubmit={(event) => void createWork(event)}
          >
            <h2>새 작품 추가</h2>
            <label>
              <span>작품 제목</span>
              <input
                maxLength={120}
                onChange={(event) => setNewWorkTitle(event.currentTarget.value)}
                required
                value={newWorkTitle}
              />
            </label>
            <label className="private-fiction-upload">
              첫 판본 Markdown 원고
              <input
                accept=".md,.mdx,text/markdown,text/plain"
                onChange={(event) =>
                  setNewWorkFile(event.currentTarget.files?.[0])
                }
                required
                type="file"
              />
            </label>
            <button
              disabled={busy || !newWorkFile || !newWorkTitle.trim()}
              type="submit"
            >
              소유자 전용으로 추가
            </button>
          </form>
        </div>
      </section>
    );
  }

  if (!manuscript || !parsed) {
    return (
      <section className="private-fiction-shell">
        <header className="private-fiction-header">
          <div>
            <p className="private-fiction-eyebrow">개인 열람 · 검색 비노출</p>
            <h1>{activeWork?.title ?? "작품을 찾을 수 없습니다"}</h1>
            <p className="private-fiction-status" role="status">
              {message}
            </p>
          </div>
          <Link href="/private/fictions/">작품 목록으로</Link>
          <button disabled={busy} onClick={() => void load()} type="button">
            새로고침
          </button>
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
          <Link href="/private/fictions/">작품 목록으로</Link>
          {isListRoute ? (
            <Link href={workUrl(workId, editionId)}>작품으로 돌아가기</Link>
          ) : null}
          <button disabled={busy} onClick={() => void load()} type="button">
            새로고침
          </button>
          <button onClick={resetReadingHistory} type="button">
            읽은 기록 전부 리셋하기
          </button>
        </header>
        {isListRoute ? (
          <div className="private-fiction-library">
            <p className="private-fiction-eyebrow">
              {activeWork?.title ?? "비공개 소설"} · 회차 목록
            </p>
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
            <h2>
              {activeWork?.title ?? manuscript.workTitle ?? "비공개 소설"}
            </h2>
            <p>회차를 골라 이어 읽을 수 있습니다.</p>
            <div className="private-fiction-library-actions">
              <Link href={workUrl(workId, editionId, true)}>
                회차 목록 보기
              </Link>
              {episodes[0] ? (
                <button
                  onClick={() => chooseSection(episodes[0]!.id, "start")}
                  type="button"
                >
                  1화부터 읽기
                </button>
              ) : null}
              {lastReadSection ? (
                <button
                  onClick={() => chooseSection(lastReadSection.id)}
                  type="button"
                >
                  계속해서 읽기
                </button>
              ) : null}
            </div>
            {activeWork ? (
              <details className="private-fiction-editions">
                <summary>보관함 관리</summary>
                <ul>
                  {activeWork.editions.map((edition, index) => (
                    <li key={edition.id}>
                      <Link
                        href={workUrl(workId, edition.id)}
                        aria-current={
                          edition.id === editionId ? "page" : undefined
                        }
                      >
                        보관본 {index + 1}
                      </Link>
                    </li>
                  ))}
                </ul>
                <form
                  className="private-fiction-new-edition"
                  onSubmit={(event) => void createEdition(event)}
                >
                  <h3>판본 추가</h3>
                  <label>
                    <span>판본 이름</span>
                    <input
                      maxLength={120}
                      onChange={(event) =>
                        setNewEditionLabel(event.currentTarget.value)
                      }
                      required
                      value={newEditionLabel}
                    />
                  </label>
                  <label className="private-fiction-upload">
                    새 판본 Markdown 원고
                    <input
                      accept=".md,.mdx,text/markdown,text/plain"
                      onChange={(event) =>
                        setNewEditionFile(event.currentTarget.files?.[0])
                      }
                      required
                      type="file"
                    />
                  </label>
                  <button
                    disabled={
                      busy || !newEditionFile || !newEditionLabel.trim()
                    }
                    type="submit"
                  >
                    판본 저장
                  </button>
                </form>
              </details>
            ) : null}
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
          <Link href={workUrl(workId, editionId, true)}>
            작품 목차로 돌아가기
          </Link>
        </header>
      </section>
    );
  }

  const episodeLabel =
    selected.kind === "episode" && selected.episode
      ? `${activeWork?.title ?? "비공개 소설"} · ${selected.episode}화`
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
        key={`${selected.id}:${readingReset}`}
        selectionMode={
          selectionMode || Boolean(pendingFeedback || selectionPreview)
        }
        className="private-fiction-book-viewport"
        immersive
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
            ? workId === "reality-error" && editionId === "current"
              ? `private-fiction-episode-${selected.episode}`
              : `private-fiction-${workId}-${editionId}-episode-${selected.episode}`
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
                <h1>{contentsEntryTitle(selected)}</h1>
              </header>
              <section
                aria-label={`${episodeLabel} 본문`}
                className="book-article-body"
                ref={bodyRef}
                onKeyUp={(event) => beginFeedbackSelection(event.currentTarget)}
                onMouseUp={(event) =>
                  event.detail < 2 &&
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
              <Link href={workUrl(workId, editionId, true)}>회차 목록</Link>
              <Link href="/admin/">Admin</Link>
              <button
                type="button"
                aria-label={`회차 피드백 ${feedbackGroups.length}개`}
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
      {selectionPreview && !pendingFeedback ? (
        <section
          className="private-fiction-selection-action"
          aria-label="선택한 부분의 리뷰"
        >
          <button
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setPendingFeedback(selectionPreview);
              setSelectionPreview(undefined);
              setFeedbackComment("");
              setFeedbackMessage("선택한 부분에 코멘트를 작성해 주세요.");
            }}
            type="button"
          >
            선택한 부분에 리뷰 남기기
          </button>
          <button
            onClick={() => {
              setSelectionPreview(undefined);
              setSelectionMode(false);
              window.getSelection()?.removeAllRanges();
            }}
            type="button"
          >
            선택 취소
          </button>
        </section>
      ) : null}
      {selectionMode && !pendingFeedback && !selectionPreview ? (
        <section
          className="private-fiction-feedback-composer"
          aria-label="본문 선택 안내"
        >
          <p>
            리뷰할 부분을 드래그하거나 길게 눌러 선택하세요. 여러 문단도 선택할
            수 있습니다.
          </p>
          <p role="status">{feedbackMessage}</p>
          <button onClick={() => setSelectionMode(false)} type="button">
            읽기로 돌아가기
          </button>
        </section>
      ) : null}
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
                setSelectionMode(false);
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
          <>
            <ReaderSettingsPanel
              labels={{
                background: "배경색",
                font: "글꼴",
                size: "글자 크기",
                line: "줄 간격",
                reset: "기본 설정으로",
                stored:
                  "읽기 설정은 공개 소설과 함께 이 브라우저에 저장됩니다.",
                white: "흰색",
                paper: "종이",
                night: "어둡게",
                sans: "고딕",
                serif: "명조",
              }}
              onChange={changePreferences}
              preferences={preferences}
            />
            <button onClick={resetReadingHistory} type="button">
              읽은 기록 전부 리셋하기
            </button>
          </>
        ) : feedbackOpen ? (
          <section className="private-fiction-feedback-list">
            <button
              onClick={() => {
                dialog.current?.close();
                setSelectionMode(true);
                setFeedbackMessage(
                  "본문에서 2,000자 이내의 부분을 선택해 주세요.",
                );
              }}
              type="button"
            >
              본문 선택해서 리뷰 남기기
            </button>
            <p className="private-fiction-dialog-status" role="status">
              {feedbackMessage}
            </p>
            {feedbackGroups.length ? (
              <ol>
                {feedbackGroups.map((annotation) => (
                  <li key={annotation.id}>
                    <blockquote>{annotation.quote}</blockquote>
                    <p>{annotation.comment}</p>
                    <time dateTime={annotation.createdAt}>
                      {new Date(annotation.createdAt).toLocaleString("ko-KR")}
                    </time>
                    <button
                      disabled={feedbackBusy}
                      onClick={() => void deleteFeedback(annotation.ids)}
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
