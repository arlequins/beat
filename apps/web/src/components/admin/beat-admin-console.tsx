"use client";

import { ExternalLink, LogOut, Save, Send, ShieldCheck } from "lucide-react";
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
    <section className="mx-auto grid max-w-5xl gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] pb-5">
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-[var(--accent-foreground)] uppercase">
            S3 editorial workspace
          </p>
          <h1 className="mt-2 font-serif text-4xl font-black">기사 검토</h1>
        </div>
        <button
          className="flex items-center gap-2 border border-[var(--line)] px-4 py-2 text-sm font-bold"
          onClick={() => void logoutBeatAdmin()}
          type="button"
        >
          <LogOut className="size-4" />
          로그아웃
        </button>
      </header>

      <div className="grid gap-3 border border-[var(--line)] bg-[var(--surface)] p-5 md:grid-cols-[1fr_auto]">
        <label className="grid gap-2 text-sm font-bold">
          글 슬러그
          <input
            className="border border-[var(--line)] bg-[var(--background)] px-3 py-2"
            onChange={(event) => setSlug(event.target.value)}
            placeholder="weekly-it-brief-2026-08-03"
            value={slug}
          />
        </label>
        <button
          className="self-end border border-[var(--line)] px-5 py-2 font-bold"
          disabled={busy || !slug}
          onClick={() => void loadDraft()}
          type="button"
        >
          불러오기
        </button>
      </div>

      <div className="grid gap-4 border border-[var(--line)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl font-black">기사 목록</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              저장소의 발행 글과 S3에 저장된 초안을 함께 표시합니다.
            </p>
          </div>
          <button
            className="border border-[var(--line)] px-4 py-2 text-sm font-bold disabled:opacity-50"
            disabled={busy}
            onClick={() => void loadRecords()}
            type="button"
          >
            목록 새로고침
          </button>
        </div>
        {records.length ? (
          <div className="grid gap-2">
            {records.map((record) => (
              <button
                className="grid gap-1 border border-[var(--line)] p-3 text-left transition-colors hover:bg-[var(--background)] md:grid-cols-[1fr_auto] md:items-center"
                key={record.slug}
                onClick={() => void loadDraft(record.slug)}
                type="button"
              >
                <span>
                  <span className="block font-bold">{record.title}</span>
                  <span className="mt-1 block font-mono text-xs text-[var(--muted-foreground)]">
                    {record.slug}
                  </span>
                </span>
                <span className="text-xs font-bold tracking-[0.12em] text-[var(--muted-foreground)] uppercase">
                  {record.origin === "repository" ? "저장소" : "S3 초안"} ·{" "}
                  {record.status}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="border border-dashed border-[var(--line)] p-4 text-sm text-[var(--muted-foreground)]">
            저장소와 초안에 기록이 없습니다.
          </p>
        )}
      </div>

      <div className="grid gap-4 border border-[var(--line)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold tracking-[0.12em] uppercase">
          <span>Revision {revision}</span>
          <span>{status}</span>
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
            className="min-h-[32rem] resize-y border border-[var(--line)] bg-[var(--background)] p-4 font-mono text-sm leading-6"
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
          <p className="text-sm text-[var(--muted-foreground)]">{message}</p>
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
      </div>
      <GourmetManager />
    </section>
  );
}
