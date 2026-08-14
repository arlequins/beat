"use client";

import {
  ExternalLink,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { GourmetManager } from "~/components/admin/gourmet-manager";

import {
  authorizedBeatAdminRequest,
  BeatAdminSessionEvent,
  hasPersistentBeatAdminSession,
  logoutBeatAdmin,
  startBeatAdminGoogleLogin,
} from "~/lib/beat-admin-session";

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
  const [authenticated, setAuthenticated] = useState(false);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("---\n");
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState<Draft["status"]>("draft");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [prUrl, setPrUrl] = useState<string>();
  const [records, setRecords] = useState<ContentRecord[]>([]);

  useEffect(() => {
    const sync = () => setAuthenticated(hasPersistentBeatAdminSession());
    sync();
    window.addEventListener(BeatAdminSessionEvent, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(BeatAdminSessionEvent, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  async function loginWithGoogle() {
    setBusy(true);
    setMessage("");
    try {
      await startBeatAdminGoogleLogin();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "로그인 실패");
    } finally {
      setBusy(false);
    }
  }

  const loadRecords = useCallback(async () => {
    setBusy(true);
    try {
      const response = await authorizedBeatAdminRequest("/admin/content");
      if (!response.ok) throw new Error("기사 목록을 불러올 수 없습니다.");
      const result = (await response.json()) as { records: ContentRecord[] };
      setRecords(result.records);
      if (!result.records.length)
        setMessage("저장소와 초안에 기록이 없습니다.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "기사 목록 조회 실패",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (authenticated) void loadRecords();
  }, [authenticated, loadRecords]);

  async function loadDraft(selectedSlug = slug) {
    if (!selectedSlug) return;
    setSlug(selectedSlug);
    setBusy(true);
    setMessage("");
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
        setMessage("새 초안을 시작합니다.");
        return;
      }
      if (!response.ok) throw new Error("초안을 불러올 수 없습니다.");
      const draft = (await response.json()) as Draft;
      setRevision(draft.revision);
      setTitle(draft.title);
      setSource(draft.source);
      setStatus(draft.status);
      setMessage(
        draft.revision === 0
          ? "저장소의 원문을 불러왔습니다. 저장하면 새 초안이 됩니다."
          : `리비전 ${draft.revision}을 불러왔습니다.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "초안 조회 실패");
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    setBusy(true);
    setMessage("");
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
      if (response.status === 409)
        throw new Error("다른 변경이 먼저 저장됐습니다. 다시 불러오세요.");
      if (!response.ok) throw new Error("초안을 저장할 수 없습니다.");
      const draft = (await response.json()) as Draft;
      setRevision(draft.revision);
      setStatus(draft.status);
      setMessage(`리비전 ${draft.revision}을 S3에 저장했습니다.`);
      void loadRecords();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "초안 저장 실패");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDraft() {
    setBusy(true);
    setMessage("");
    try {
      const response = await authorizedBeatAdminRequest(
        `/admin/content/drafts/${encodeURIComponent(slug)}/confirm`,
        {
          body: JSON.stringify({ expectedRevision: revision }),
          method: "POST",
        },
      );
      if (response.status === 409)
        throw new Error("최신 리비전을 다시 불러온 뒤 확정하세요.");
      if (!response.ok) throw new Error("GitHub 검토 요청을 만들 수 없습니다.");
      const publication = (await response.json()) as Publication;
      setStatus("confirmed");
      setPrUrl(publication.prUrl);
      setRevision((current) => current + 1);
      setMessage("확정본으로 기록하고 GitHub 검토 요청을 만들었습니다.");
      void loadRecords();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "확정 실패");
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
    setPrUrl(undefined);
    setMessage("새 글을 시작합니다. 슬러그와 제목을 입력하세요.");
  }

  const draftCount = records.filter(
    (record) => record.origin === "draft",
  ).length;
  const reviewCount = records.filter(
    (record) => record.reviewStatus === "unreviewed",
  ).length;

  if (!authenticated)
    return (
      <section className="mx-auto grid max-w-md gap-4 border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[0.5rem_0.5rem_0_var(--shadow-accent)]">
        <ShieldCheck className="size-8 text-[var(--accent-foreground)]" />
        <div>
          <h1 className="font-serif text-3xl font-black">Beat 관리자</h1>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Google 계정으로 로그인하면 Beat 채팅과 기사 검토 도구가 열립니다.
          </p>
        </div>
        <button
          className="bg-[var(--foreground)] px-4 py-3 font-bold text-[var(--background)] disabled:opacity-50"
          disabled={busy}
          onClick={() => void loginWithGoogle()}
          type="button"
        >
          Google 계정으로 계속
        </button>
        {message ? (
          <p className="text-sm text-[var(--muted-foreground)]">{message}</p>
        ) : null}
      </section>
    );

  return (
    <section className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-[var(--line)] pb-6">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-[var(--accent-foreground)] uppercase">
            Editorial workspace
          </p>
          <h1 className="mt-2 font-serif text-5xl font-black tracking-[-0.04em]">
            기사 검토
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted-foreground)]">
            저장소 원문을 확인하고, S3에서 안전하게 초안을 만든 뒤 GitHub 검토
            요청으로 넘깁니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-2 border border-[var(--line)] px-4 py-2 text-sm font-bold"
            onClick={startNewArticle}
            type="button"
          >
            <Plus className="size-4" />새 글
          </button>
          <button
            className="flex items-center gap-2 border border-[var(--line)] px-4 py-2 text-sm font-bold"
            onClick={() => void logoutBeatAdmin()}
            type="button"
          >
            <LogOut className="size-4" />
            로그아웃
          </button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["전체 글", records.length, "저장소 원문과 초안"],
          ["S3 초안", draftCount, "편집 중인 리비전"],
          ["검토 필요", reviewCount, "reviewStatus: unreviewed"],
        ].map(([label, value, detail]) => (
          <div
            className="border border-[var(--line)] bg-[var(--surface)] p-5"
            key={label}
          >
            <p className="text-xs font-bold tracking-[0.14em] text-[var(--muted-foreground)] uppercase">
              {label}
            </p>
            <p className="mt-2 font-serif text-3xl font-black">{value}</p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {detail}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="border border-[var(--line)] bg-[var(--surface)] lg:sticky lg:top-6 lg:self-start">
          <div className="flex items-center justify-between border-b border-[var(--line)] p-4">
            <div>
              <h2 className="font-serif text-2xl font-black">기사 목록</h2>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                {records.length}개 기록
              </p>
            </div>
            <button
              aria-label="기사 목록 새로고침"
              className="border border-[var(--line)] p-2 disabled:opacity-50"
              disabled={busy}
              onClick={() => void loadRecords()}
              type="button"
            >
              <RefreshCw className="size-4" />
            </button>
          </div>
          <div className="max-h-[34rem] overflow-y-auto">
            {records.map((record) => (
              <button
                className="block w-full border-b border-[var(--line)] p-4 text-left transition-colors hover:bg-[var(--background)]"
                key={record.slug}
                onClick={() => void loadDraft(record.slug)}
                type="button"
              >
                <span className="block truncate font-bold">{record.title}</span>
                <span className="mt-1 block truncate font-mono text-[11px] text-[var(--muted-foreground)]">
                  {record.slug}
                </span>
                <span className="mt-3 flex items-center justify-between gap-2 text-[10px] font-bold tracking-[0.12em] text-[var(--muted-foreground)] uppercase">
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
            ))}
            {!records.length ? (
              <p className="p-5 text-sm leading-6 text-[var(--muted-foreground)]">
                저장소와 초안에 기록이 없습니다. 새 글을 만들거나 GitHub 원문을
                확인해 주세요.
              </p>
            ) : null}
          </div>
        </aside>

        <article className="grid gap-5 border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] pb-5">
            <div>
              <p className="text-xs font-bold tracking-[0.14em] text-[var(--muted-foreground)] uppercase">
                Article editor
              </p>
              <h2 className="mt-2 font-serif text-3xl font-black">원문 편집</h2>
            </div>
            <div className="text-right text-xs font-bold tracking-[0.12em] text-[var(--muted-foreground)] uppercase">
              <p>Revision {revision}</p>
              <p className="mt-1 text-[var(--accent-foreground)]">{status}</p>
            </div>
          </header>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="grid gap-2 text-sm font-bold">
              글 슬러그
              <input
                className="border border-[var(--line)] bg-[var(--background)] px-3 py-2 font-mono text-sm font-normal"
                onChange={(event) => setSlug(event.target.value)}
                placeholder="weekly-it-brief-2026-08-03"
                value={slug}
              />
            </label>
            <button
              className="border border-[var(--line)] px-5 py-2 font-bold disabled:opacity-50"
              disabled={busy || !slug}
              onClick={() => void loadDraft()}
              type="button"
            >
              원문 불러오기
            </button>
          </div>
          <label className="grid gap-2 text-sm font-bold">
            제목
            <input
              className="border border-[var(--line)] bg-[var(--background)] px-3 py-2"
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            MDX 원문
            <textarea
              className="min-h-[28rem] resize-y border border-[var(--line)] bg-[var(--background)] p-4 font-mono text-sm leading-6"
              onChange={(event) => setSource(event.target.value)}
              spellCheck={false}
              value={source}
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              className="flex items-center gap-2 border border-[var(--line)] px-5 py-3 font-bold disabled:opacity-50"
              disabled={busy || !slug || !title}
              onClick={() => void saveDraft()}
              type="button"
            >
              <Save className="size-4" />
              S3에 저장
            </button>
            <button
              className="flex items-center gap-2 bg-[var(--foreground)] px-5 py-3 font-bold text-[var(--background)] disabled:opacity-50"
              disabled={busy || revision < 1 || status === "confirmed"}
              onClick={() => void confirmDraft()}
              type="button"
            >
              <Send className="size-4" />
              확정하고 GitHub 검토 요청
            </button>
          </div>
          {message ? (
            <p className="border-l-2 border-[var(--accent)] pl-3 text-sm text-[var(--muted-foreground)]">
              {message}
            </p>
          ) : null}
          {prUrl ? (
            <a
              className="flex items-center gap-2 font-bold text-[var(--accent-foreground)] underline"
              href={prUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              GitHub에서 검토하기
              <ExternalLink className="size-4" />
            </a>
          ) : null}
        </article>
      </div>
      <GourmetManager />
    </section>
  );
}
