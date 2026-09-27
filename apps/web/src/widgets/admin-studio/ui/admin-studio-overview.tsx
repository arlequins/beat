"use client";

import { ArrowRight, FileText, Utensils } from "lucide-react";
import { useEffect, useState } from "react";
import { type GourmetList, gourmetApiUrl } from "~/entities/gourmet";

type Props = {
  onOpenArticles: () => void;
  onOpenGourmet: () => void;
  articleCount: number;
  reviewCount: number;
};

export function AdminStudioOverview({
  onOpenArticles,
  onOpenGourmet,
  articleCount,
  reviewCount,
}: Props) {
  const [gourmetTotal, setGourmetTotal] = useState<number>();

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${gourmetApiUrl()}/api/gourmet/entries?pageSize=1`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        const result = (await response.json()) as GourmetList;
        setGourmetTotal(result.total);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  return (
    <section
      aria-labelledby="studio-overview-title"
      className="grid gap-4 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7"
      id="studio-overview"
    >
      <div>
        <p className="text-xs font-bold tracking-[0.16em] text-[var(--accent-foreground)] uppercase">
          Workspace
        </p>
        <h2
          className="mt-2 font-serif text-3xl font-black tracking-[-0.04em]"
          id="studio-overview-title"
        >
          어떤 작업을 할까요?
        </h2>
      </div>

      <div className="grid gap-3">
        <button
          className="group flex w-full items-center gap-4 rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4 text-left transition-colors hover:border-[var(--accent-foreground)] hover:bg-[var(--accent-foreground)]/5 sm:px-5"
          onClick={onOpenArticles}
          type="button"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--coral)]/15 text-[var(--coral)]">
            <FileText className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold">기사 작성·검토</span>
            <span className="mt-1 block text-sm text-[var(--muted-foreground)]">
              기사 편집, 미리보기, 저장, GitHub 검토 요청
            </span>
            <span className="mt-2 block text-xs font-semibold text-[var(--muted-foreground)]">
              기사 {articleCount}개 · 검토 필요 {reviewCount}개
            </span>
          </span>
          <ArrowRight className="size-5 shrink-0 text-[var(--muted-foreground)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--foreground)]" />
        </button>

        <button
          className="group flex w-full items-center gap-4 rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4 text-left transition-colors hover:border-[var(--accent-foreground)] hover:bg-[var(--accent-foreground)]/5 sm:px-5"
          onClick={onOpenGourmet}
          type="button"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--gold)]/15 text-[var(--gold)]">
            <Utensils className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold">Gourmet 기록 관리</span>
            <span className="mt-1 block text-sm text-[var(--muted-foreground)]">
              식사 기록, 사진 설명, 공개 상태 관리
            </span>
            <span className="mt-2 block text-xs font-semibold text-[var(--muted-foreground)]">
              {gourmetTotal === undefined
                ? "기록 수 확인 중"
                : `Gourmet 기록 ${gourmetTotal}개`}
            </span>
          </span>
          <ArrowRight className="size-5 shrink-0 text-[var(--muted-foreground)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--foreground)]" />
        </button>
      </div>
    </section>
  );
}
