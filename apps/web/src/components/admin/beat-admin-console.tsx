"use client";

import {
  AlertCircle,
  Bold,
  Check,
  Code2,
  ExternalLink,
  Eye,
  FileText,
  List,
  LoaderCircle,
  LogOut,
  MessageCircle,
  PenLine,
  Plus,
  Quote,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { GourmetManager } from "~/components/admin/gourmet-manager";
import { MdxPreview } from "~/components/admin/mdx-preview";

import {
  authorizedBeatAdminRequest,
  BeatAdminSessionEvent,
  clearBeatAdminSession,
  hasPersistentBeatAdminSession,
  logoutBeatAdmin,
  startBeatAdminGoogleLogin,
} from "~/lib/beat-admin-session";

type AuthStatus = "loading" | "authenticated" | "anonymous";
type MessageTone = "error" | "info";

type Draft = {
  revision: number;
  slug: string;
  source: string;
  status: "draft" | "confirmed";
  title: string;
};

type Publication = {
  prUrl?: string;
  status: "pending" | "opened";
};

type ContentRecord = {
  category?: string;
  origin: "draft" | "repository";
  publishedAt?: string;
  reviewStatus?: "reviewed" | "unreviewed";
  revision: number;
  slug: string;
  status: "confirmed" | "draft" | "published";
  title: string;
  updatedAt?: string;
};

export function BeatAdminConsole() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("---\n");
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState<Draft["status"]>("draft");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<MessageTone>("info");
  const [busy, setBusy] = useState(false);
  const [prUrl, setPrUrl] = useState<string>();
  const [records, setRecords] = useState<ContentRecord[]>([]);
  const [editorMode, setEditorMode] = useState<"preview" | "write">("write");
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const authenticated = authStatus === "authenticated";

  const showMessage = useCallback(
    (value: string, tone: MessageTone = "info") => {
      setMessage(value);
      setMessageTone(tone);
    },
    [],
  );

  const clearMessage = useCallback(() => {
    setMessage("");
    setMessageTone("info");
  }, []);

  useEffect(() => {
    const sync = () => {
      if (!hasPersistentBeatAdminSession()) setAuthStatus("anonymous");
    };
    window.addEventListener(BeatAdminSessionEvent, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(BeatAdminSessionEvent, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  async function loginWithGoogle() {
    setBusy(true);
    clearMessage();
    try {
      await startBeatAdminGoogleLogin();
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : "로그인 실패",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  const loadRecords = useCallback(async () => {
    setBusy(true);
    try {
      const response = await authorizedBeatAdminRequest("/admin/content");
      if (response.status === 401) {
        clearBeatAdminSession();
        throw new Error("로그인이 만료되었습니다. 다시 로그인해 주세요.");
      }
      if (!response.ok) throw new Error("기사 목록을 불러올 수 없습니다.");
      const result = (await response.json()) as { records: ContentRecord[] };
      setRecords(result.records);
      if (!result.records.length)
        showMessage("저장소와 초안에 기록이 없습니다.");
      return true;
    } catch (error) {
      const nextMessage =
        error instanceof Error ? error.message : "기사 목록 조회 실패";
      showMessage(nextMessage, "error");
      if (!hasPersistentBeatAdminSession()) setAuthStatus("anonymous");
      return false;
    } finally {
      setBusy(false);
    }
  }, [showMessage]);

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      if (!hasPersistentBeatAdminSession()) {
        setAuthStatus("anonymous");
        return;
      }
      await loadRecords();
      if (active)
        setAuthStatus(
          hasPersistentBeatAdminSession() ? "authenticated" : "anonymous",
        );
    };
    void bootstrap();
    return () => {
      active = false;
    };
  }, [loadRecords]);

  function editorInsert(before: string, after = "") {
    const editor = editorRef.current;
    if (!editor) return;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = source.slice(start, end) || "텍스트";
    const nextSource = `${source.slice(0, start)}${before}${selected}${after}${source.slice(end)}`;
    setSource(nextSource);
    requestAnimationFrame(() => {
      editor.focus();
      const cursor = start + before.length + selected.length + after.length;
      editor.setSelectionRange(cursor, cursor);
    });
  }

  function editorInsertLine(prefix: string) {
    const editor = editorRef.current;
    if (!editor) return;
    const start = editor.selectionStart;
    const lineStart = source.lastIndexOf("\n", start - 1) + 1;
    const nextSource = `${source.slice(0, lineStart)}${prefix}${source.slice(lineStart)}`;
    setSource(nextSource);
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(start + prefix.length, start + prefix.length);
    });
  }

  function onEditorKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Tab") return;
    event.preventDefault();
    editorInsert("  ");
  }

  async function loadDraft(selectedSlug = slug) {
    if (!selectedSlug) return;
    setSlug(selectedSlug);
    setBusy(true);
    clearMessage();
    setPrUrl(undefined);
    try {
      const response = await authorizedBeatAdminRequest(
        `/admin/content/drafts/${encodeURIComponent(selectedSlug)}`,
      );
      if (response.status === 404) {
        setRevision(0);
        setTitle("");
        setSource("---\n");
        setStatus("draft");
        setEditorMode("write");
        showMessage("새 초안을 시작합니다.");
        return;
      }
      if (response.status === 401) {
        clearBeatAdminSession();
        throw new Error("로그인이 만료되었습니다. 다시 로그인해 주세요.");
      }
      if (!response.ok) throw new Error("초안을 불러올 수 없습니다.");
      const draft = (await response.json()) as Draft;
      setRevision(draft.revision);
      setTitle(draft.title);
      setSource(draft.source);
      setStatus(draft.status);
      setEditorMode("write");
      showMessage(
        draft.revision === 0
          ? "저장소의 원문을 불러왔습니다. 저장하면 새 초안이 됩니다."
          : `리비전 ${draft.revision}을 불러왔습니다.`,
      );
    } catch (error) {
      const nextMessage =
        error instanceof Error ? error.message : "초안 조회 실패";
      showMessage(nextMessage, "error");
      if (!hasPersistentBeatAdminSession()) setAuthStatus("anonymous");
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    setBusy(true);
    clearMessage();
    try {
      const response = await authorizedBeatAdminRequest(
        `/admin/content/drafts/${encodeURIComponent(slug)}`,
        {
          body: JSON.stringify({
            expectedRevision: revision,
            source,
            title,
          }),
          method: "PUT",
        },
      );
      if (response.status === 401) {
        clearBeatAdminSession();
        throw new Error("로그인이 만료되었습니다. 다시 로그인해 주세요.");
      }
      if (response.status === 409)
        throw new Error("다른 변경이 먼저 저장됐습니다. 다시 불러오세요.");
      if (!response.ok) throw new Error("초안을 저장할 수 없습니다.");
      const draft = (await response.json()) as Draft;
      setRevision(draft.revision);
      setStatus(draft.status);
      showMessage(`리비전 ${draft.revision}을 S3에 저장했습니다.`);
      void loadRecords();
    } catch (error) {
      const nextMessage =
        error instanceof Error ? error.message : "초안 저장 실패";
      showMessage(nextMessage, "error");
      if (!hasPersistentBeatAdminSession()) setAuthStatus("anonymous");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDraft() {
    setBusy(true);
    clearMessage();
    try {
      const response = await authorizedBeatAdminRequest(
        `/admin/content/drafts/${encodeURIComponent(slug)}/confirm`,
        {
          body: JSON.stringify({ expectedRevision: revision }),
          method: "POST",
        },
      );
      if (response.status === 401) {
        clearBeatAdminSession();
        throw new Error("로그인이 만료되었습니다. 다시 로그인해 주세요.");
      }
      if (response.status === 409)
        throw new Error("최신 리비전을 다시 불러온 뒤 확정하세요.");
      if (!response.ok) throw new Error("GitHub 검토 요청을 만들 수 없습니다.");
      const publication = (await response.json()) as Publication;
      setStatus("confirmed");
      setPrUrl(publication.prUrl);
      setRevision((current) => current + 1);
      showMessage("확정본으로 기록하고 GitHub 검토 요청을 만들었습니다.");
      void loadRecords();
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "확정 실패";
      showMessage(nextMessage, "error");
      if (!hasPersistentBeatAdminSession()) setAuthStatus("anonymous");
    } finally {
      setBusy(false);
    }
  }

  function startNewArticle() {
    setSlug("");
    setTitle("");
    setSource("---\n");
    setRevision(0);
    setStatus("draft");
    setEditorMode("write");
    setPrUrl(undefined);
    showMessage("새 글을 시작합니다. 슬러그와 제목을 입력하세요.");
  }

  const draftCount = records.filter(
    (record) => record.origin === "draft",
  ).length;
  const reviewCount = records.filter(
    (record) => record.reviewStatus === "unreviewed",
  ).length;

  const lineCount = source ? source.split(/\r?\n/).length : 0;
  const messageClass =
    messageTone === "error"
      ? "border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300"
      : "border-[var(--line)] bg-[var(--background)] text-[var(--muted-foreground)]";

  if (authStatus === "loading")
    return (
      <section
        aria-live="polite"
        className="mx-auto grid min-h-[60vh] max-w-md place-content-center gap-5 text-center"
        role="status"
      >
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-[var(--night)] text-[var(--cyan)] shadow-[0_1rem_3rem_rgba(17,19,38,0.2)]">
          <LoaderCircle className="size-7 animate-spin" />
        </div>
        <div>
          <p className="font-serif text-2xl font-black">Beat 관리자 준비 중</p>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            로그인 상태와 작업 공간을 확인하고 있습니다.
          </p>
        </div>
      </section>
    );

  if (!authenticated)
    return (
      <section className="mx-auto grid max-w-lg gap-5 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[0.75rem_0.75rem_0_var(--shadow-accent)] sm:p-8">
        <div className="flex items-start gap-4">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--night)] text-[var(--cyan)]">
            <ShieldCheck className="size-6" />
          </div>
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-[var(--accent-foreground)] uppercase">
              Private workspace
            </p>
            <h1 className="mt-1 font-serif text-3xl font-black tracking-[-0.03em]">
              Beat 관리자
            </h1>
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4">
          <div className="flex items-start gap-3">
            <MessageCircle className="mt-0.5 size-4 shrink-0 text-[var(--accent-foreground)]" />
            <p className="text-sm leading-6 text-[var(--muted-foreground)]">
              Google 계정으로 로그인하면 Beat 채팅과 기사 검토 도구가 열립니다.
            </p>
          </div>
        </div>
        <button
          className="flex items-center justify-center gap-2 rounded-xl bg-[var(--foreground)] px-4 py-3.5 font-bold text-[var(--background)] transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-50"
          disabled={busy}
          onClick={() => void loginWithGoogle()}
          type="button"
        >
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Google 계정으로 계속
        </button>
        {message ? (
          <p
            className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm leading-6 ${messageClass}`}
            role={messageTone === "error" ? "alert" : "status"}
          >
            {messageTone === "error" ? (
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
            ) : null}
            <span>{message}</span>
          </p>
        ) : null}
      </section>
    );

  return (
    <section className="mx-auto flex max-w-7xl flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[var(--line)] bg-[var(--surface)] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-2xl bg-[var(--night)] text-[var(--cyan)]">
            <MessageCircle className="size-5" />
          </div>
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-[var(--accent-foreground)] uppercase">
              Beat editorial chat
            </p>
            <h1 className="font-serif text-2xl font-black tracking-[-0.03em]">
              기사 작업 공간
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-bold transition-colors hover:bg-[var(--background)]"
            onClick={startNewArticle}
            type="button"
          >
            <Plus className="size-4" />새 글
          </button>
          <button
            aria-label="로그아웃"
            className="grid size-9 place-items-center rounded-xl border border-[var(--line)] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--background)] hover:text-[var(--foreground)]"
            onClick={() => void logoutBeatAdmin()}
            title="로그아웃"
            type="button"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </header>

      <div className="grid min-h-[42rem] gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)]">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-4">
            <div>
              <h2 className="font-serif text-xl font-black">대화 목록</h2>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                {records.length}개 기사
              </p>
            </div>
            <button
              aria-label="기사 목록 새로고침"
              className="grid size-9 place-items-center rounded-xl border border-[var(--line)] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--background)] disabled:opacity-50"
              disabled={busy}
              onClick={() => void loadRecords()}
              title="새로고침"
              type="button"
            >
              <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />
            </button>
          </div>
          <div className="grid grid-cols-3 border-b border-[var(--line)] text-center">
            {[
              ["전체", records.length],
              ["초안", draftCount],
              ["검토", reviewCount],
            ].map(([label, value]) => (
              <div
                className="border-r border-[var(--line)] px-2 py-3 last:border-r-0"
                key={label}
              >
                <p className="font-serif text-xl font-black">{value}</p>
                <p className="mt-0.5 text-[10px] font-bold tracking-[0.12em] text-[var(--muted-foreground)] uppercase">
                  {label}
                </p>
              </div>
            ))}
          </div>
          <nav
            aria-label="기사 목록"
            className="min-h-0 flex-1 overflow-y-auto"
          >
            {records.map((record) => {
              const selected = record.slug === slug;
              return (
                <button
                  aria-current={selected ? "page" : undefined}
                  className={`block w-full border-b border-[var(--line)] px-4 py-3.5 text-left transition-colors ${selected ? "bg-[var(--night)] text-white" : "hover:bg-[var(--background)]"}`}
                  key={record.slug}
                  onClick={() => void loadDraft(record.slug)}
                  type="button"
                >
                  <span className="flex items-start gap-2">
                    <FileText
                      className={`mt-0.5 size-4 shrink-0 ${selected ? "text-[var(--cyan)]" : "text-[var(--accent-foreground)]"}`}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">
                        {record.title}
                      </span>
                      <span
                        className={`mt-1 block truncate font-mono text-[10px] ${selected ? "text-white/60" : "text-[var(--muted-foreground)]"}`}
                      >
                        {record.slug}
                      </span>
                    </span>
                  </span>
                  <span
                    className={`mt-3 flex items-center justify-between gap-2 text-[10px] font-bold tracking-[0.1em] uppercase ${selected ? "text-white/65" : "text-[var(--muted-foreground)]"}`}
                  >
                    <span>
                      {record.origin === "repository" ? "저장소" : "S3 초안"}
                    </span>
                    <span>
                      {record.status === "published"
                        ? "발행"
                        : record.status === "confirmed"
                          ? "확정"
                          : "초안"}
                    </span>
                  </span>
                </button>
              );
            })}
            {!records.length ? (
              <p className="p-5 text-sm leading-6 text-[var(--muted-foreground)]">
                아직 기사가 없습니다. 새 글을 시작하거나 GitHub 원문을
                불러오세요.
              </p>
            ) : null}
          </nav>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)]">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] px-5 py-4 sm:px-7">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--coral)]/15 text-[var(--coral)]">
                <Sparkles className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold tracking-[0.13em] text-[var(--muted-foreground)] uppercase">
                  Lumen · editorial assistant
                </p>
                <h2 className="truncate font-serif text-xl font-black">
                  {title || "새 기사 대화"}
                </h2>
              </div>
            </div>
            <span className="rounded-full border border-[var(--line)] px-3 py-1 text-[10px] font-bold tracking-[0.12em] text-[var(--muted-foreground)] uppercase">
              Revision {revision} · {status}
            </span>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7 sm:py-7">
            <div className="mx-auto grid max-w-3xl gap-5">
              <div className="flex items-start gap-3">
                <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-[var(--night)] text-[var(--cyan)]">
                  <MessageCircle className="size-4" />
                </div>
                <div className="max-w-2xl rounded-2xl rounded-tl-sm border border-[var(--line)] bg-[var(--background)] px-4 py-3 text-sm leading-6">
                  <p className="font-bold">무엇을 다듬어볼까요?</p>
                  <p className="mt-1 text-[var(--muted-foreground)]">
                    원문을 편집하고 미리본 뒤 S3에 저장하세요. 확정하면 GitHub
                    검토 요청으로 이어집니다.
                  </p>
                </div>
              </div>

              <section className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4 sm:p-5">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                  <label className="grid gap-1.5 text-xs font-bold text-[var(--muted-foreground)]">
                    제목
                    <input
                      className="min-w-0 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm font-semibold text-[var(--foreground)] outline-none transition-colors focus:border-[var(--coral)]"
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="기사 제목"
                      value={title}
                    />
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold text-[var(--muted-foreground)]">
                    슬러그
                    <input
                      className="min-w-0 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 font-mono text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--coral)]"
                      onChange={(event) => setSlug(event.target.value)}
                      placeholder="weekly-it-brief-2026-08-03"
                      value={slug}
                    />
                  </label>
                  <button
                    className="flex items-center justify-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm font-bold transition-colors hover:bg-[var(--surface)] disabled:opacity-50"
                    disabled={busy || !slug}
                    onClick={() => void loadDraft()}
                    type="button"
                  >
                    <RefreshCw className="size-4" />
                    불러오기
                  </button>
                </div>

                <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-3 py-2">
                    <div className="flex items-center gap-1 rounded-xl bg-[var(--background)] p-1">
                      <button
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${editorMode === "write" ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
                        onClick={() => setEditorMode("write")}
                        type="button"
                      >
                        <PenLine className="size-3.5" />
                        원문
                      </button>
                      <button
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${editorMode === "preview" ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
                        onClick={() => setEditorMode("preview")}
                        type="button"
                      >
                        <Eye className="size-3.5" />
                        미리보기
                      </button>
                    </div>
                    <span className="text-[10px] font-bold tracking-[0.1em] text-[var(--muted-foreground)] uppercase">
                      MDX · {lineCount} lines · {source.length} chars
                    </span>
                  </div>

                  {editorMode === "write" ? (
                    <>
                      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--line)] px-3 py-2">
                        <button
                          aria-label="굵게"
                          className="grid size-8 place-items-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
                          onClick={() => editorInsert("**", "**")}
                          title="굵게"
                          type="button"
                        >
                          <Bold className="size-4" />
                        </button>
                        <button
                          aria-label="인라인 코드"
                          className="grid size-8 place-items-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
                          onClick={() => editorInsert("`", "`")}
                          title="인라인 코드"
                          type="button"
                        >
                          <Code2 className="size-4" />
                        </button>
                        <button
                          aria-label="목록"
                          className="grid size-8 place-items-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
                          onClick={() => editorInsertLine("- ")}
                          title="목록"
                          type="button"
                        >
                          <List className="size-4" />
                        </button>
                        <button
                          aria-label="인용"
                          className="grid size-8 place-items-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
                          onClick={() => editorInsertLine("> ")}
                          title="인용"
                          type="button"
                        >
                          <Quote className="size-4" />
                        </button>
                        <button
                          aria-label="소제목"
                          className="grid size-8 place-items-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
                          onClick={() => editorInsertLine("## ")}
                          title="소제목"
                          type="button"
                        >
                          <span className="text-xs font-black">H2</span>
                        </button>
                      </div>
                      <textarea
                        aria-label="MDX 원문"
                        className="min-h-[28rem] w-full resize-y bg-[var(--surface)] p-4 font-mono text-sm leading-7 text-[var(--foreground)] outline-none"
                        onChange={(event) => setSource(event.target.value)}
                        onKeyDown={onEditorKeyDown}
                        ref={editorRef}
                        spellCheck={false}
                        value={source}
                      />
                    </>
                  ) : (
                    <div className="min-h-[28rem] p-5 sm:p-7">
                      <MdxPreview source={source} />
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>

          <footer className="border-t border-[var(--line)] bg-[var(--background)] px-4 py-3 sm:px-7">
            <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                {message ? (
                  <p
                    className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm leading-5 ${messageClass}`}
                    role={messageTone === "error" ? "alert" : "status"}
                  >
                    {messageTone === "error" ? (
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    ) : (
                      <Check className="mt-0.5 size-4 shrink-0 text-[var(--accent-foreground)]" />
                    )}
                    <span className="truncate">{message}</span>
                  </p>
                ) : (
                  <p className="text-xs text-[var(--muted-foreground)]">
                    저장 전에는 변경사항이 S3에 반영되지 않습니다.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="flex items-center gap-2 rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm font-bold transition-colors hover:bg-[var(--surface)] disabled:opacity-50"
                  disabled={busy || !slug || !title}
                  onClick={() => void saveDraft()}
                  type="button"
                >
                  <Save className="size-4" />
                  저장
                </button>
                <button
                  className="flex items-center gap-2 rounded-xl bg-[var(--foreground)] px-4 py-2.5 text-sm font-bold text-[var(--background)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={busy || revision < 1 || status === "confirmed"}
                  onClick={() => void confirmDraft()}
                  type="button"
                >
                  <Send className="size-4" />
                  검토 요청
                </button>
              </div>
            </div>
            {prUrl ? (
              <div className="mx-auto mt-2 max-w-3xl">
                <a
                  className="inline-flex items-center gap-2 text-sm font-bold text-[var(--accent-foreground)] underline underline-offset-4"
                  href={prUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  GitHub에서 검토하기 <ExternalLink className="size-4" />
                </a>
              </div>
            ) : null}
          </footer>
        </main>
      </div>
      <GourmetManager />
    </section>
  );
}
