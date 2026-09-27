"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  authorizedBeatAdminRequest,
  BeatAdminSessionEvent,
  hasPersistentBeatAdminSession,
} from "~/lib/beat-admin-session";

type Manuscript = { etag: string; source: string; updatedAt: string };

export function PrivateFictionReader() {
  const [authenticated, setAuthenticated] = useState(false);
  const [manuscript, setManuscript] = useState<Manuscript>();
  const [message, setMessage] = useState("로그인 상태를 확인하고 있습니다.");
  const [busy, setBusy] = useState(false);

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
      await load();
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
    <section className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-3">
        <p className="text-sm font-medium text-[var(--muted-foreground)]">
          개인 열람 · 검색 비노출
        </p>
        <h1 className="text-3xl font-semibold">비공개 원고 보관함</h1>
        <p className="text-sm text-[var(--muted-foreground)]" role="status">
          {message}
        </p>
      </header>
      <div className="flex flex-wrap items-center gap-3">
        {!authenticated && (
          <Link className="rounded-md border px-4 py-2" href="/admin/">
            관리자 로그인으로 이동
          </Link>
        )}
        {authenticated && (
          <label className="cursor-pointer rounded-md border px-4 py-2">
            원고 Markdown 불러오기
            <input
              accept=".md,.mdx,text/markdown,text/plain"
              className="sr-only"
              disabled={busy}
              onChange={(event) => void upload(event.currentTarget.files?.[0])}
              type="file"
            />
          </label>
        )}
        {authenticated && (
          <button
            className="rounded-md border px-4 py-2"
            disabled={busy}
            onClick={() => void load()}
            type="button"
          >
            새로고침
          </button>
        )}
      </div>
      {manuscript && authenticated && (
        <article className="overflow-hidden rounded-xl border">
          <p className="border-b px-4 py-3 text-xs text-[var(--muted-foreground)]">
            저장 시각: {new Date(manuscript.updatedAt).toLocaleString()}
          </p>
          <pre className="max-h-[72vh] overflow-auto whitespace-pre-wrap break-words p-5 text-sm leading-7">
            {manuscript.source}
          </pre>
        </article>
      )}
    </section>
  );
}
