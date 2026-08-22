"use client";

import {
  ArrowUpRight,
  ClipboardCheck,
  FileWarning,
  History,
  MessageCircle,
  RefreshCw,
  Utensils,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  recentStudioRecords,
  type StudioContentRecord,
  studioHealth,
} from "~/entities/content/model/studio-insights";
import { type GourmetList, gourmetApiUrl } from "~/entities/gourmet";

type Props = {
  onNewArticle: () => void;
  onSelectRecord: (slug: string) => void;
  records: StudioContentRecord[];
};

const statusLabel: Record<StudioContentRecord["status"], string> = {
  confirmed: "확정",
  draft: "초안",
  published: "발행",
};

export function AdminStudioOverview({
  onNewArticle,
  onSelectRecord,
  records,
}: Props) {
  const [gourmetTotal, setGourmetTotal] = useState<number>();
  const health = useMemo(() => studioHealth(records), [records]);
  const recent = useMemo(() => recentStudioRecords(records), [records]);

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

  const cards = [
    {
      accent: "text-[var(--coral)]",
      label: "전체 콘텐츠",
      value: health.total,
    },
    {
      accent: "text-[var(--gold)]",
      label: "검토 필요",
      value: health.needsAttention,
    },
    {
      accent: "text-[var(--cyan)]",
      label: "확정·발행",
      value: health.confirmed + health.published,
    },
    {
      accent: "text-[var(--accent-foreground)]",
      label: "Gourmet 기록",
      value: gourmetTotal ?? "—",
    },
  ];

  return (
    <section
      aria-labelledby="studio-overview-title"
      className="grid gap-4 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6"
      id="studio-overview"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-[var(--accent-foreground)] uppercase">
            Arlequin · control room
          </p>
          <h2
            className="mt-2 font-serif text-3xl font-black tracking-[-0.04em]"
            id="studio-overview-title"
          >
            오늘의 작업 보드
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
            Lumen의 초안을 확인하고, Arlequin의 판단으로 다음 공개 상태를
            결정하는 공간입니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-bold transition-colors hover:bg-[var(--background)]"
            href="#gourmet-workspace"
          >
            <Utensils className="size-4" /> Gourmet
          </a>
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--foreground)] px-3 py-2 text-sm font-bold text-[var(--background)] transition-transform hover:-translate-y-0.5"
            onClick={onNewArticle}
            type="button"
          >
            새 작업 시작 <ArrowUpRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4"
            key={card.label}
          >
            <p className={`text-3xl font-black ${card.accent}`}>{card.value}</p>
            <p className="mt-1 text-xs font-bold tracking-[0.08em] text-[var(--muted-foreground)] uppercase">
              {card.label}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <History className="size-4 text-[var(--accent-foreground)]" />
              <h3 className="text-sm font-bold">최근 활동</h3>
            </div>
            <span className="text-xs text-[var(--muted-foreground)]">
              {health.reviewed} reviewed · {health.unreviewed} unreviewed
            </span>
          </div>
          <div className="mt-3 divide-y divide-[var(--line)]">
            {recent.map((record) => (
              <button
                className="flex w-full items-center justify-between gap-3 py-3 text-left transition-colors hover:text-[var(--accent-foreground)]"
                key={record.slug}
                onClick={() => onSelectRecord(record.slug)}
                type="button"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">
                    {record.title || "제목 없는 작업"}
                  </span>
                  <span className="mt-1 block truncate font-mono text-[10px] text-[var(--muted-foreground)]">
                    {record.slug}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-[var(--muted-foreground)]">
                  {statusLabel[record.status]}
                  <ArrowUpRight className="size-3.5" />
                </span>
              </button>
            ))}
            {!recent.length ? (
              <p className="py-6 text-sm text-[var(--muted-foreground)]">
                아직 콘텐츠 활동이 없습니다. 새 작업을 시작해 보세요.
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <div className="rounded-2xl border border-[var(--gold)]/35 bg-[var(--gold)]/10 p-4">
            <div className="flex items-center gap-2 text-sm font-bold">
              <FileWarning className="size-4 text-[var(--gold)]" />
              품질 확인
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              {health.needsAttention
                ? `${health.needsAttention}개 항목에 검토나 메타데이터 확인이 필요합니다.`
                : "현재 확인이 필요한 콘텐츠가 없습니다."}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--cyan)]/35 bg-[var(--cyan)]/10 p-4">
            <div className="flex items-center gap-2 text-sm font-bold">
              <MessageCircle className="size-4 text-[var(--cyan)]" />
              Agent 연결
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              글과 Gourmet 기록에서 Agent에게 맥락을 전달하고 출처·피드백으로
              이어갈 수 있습니다.
            </p>
            <a
              className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[var(--accent-foreground)] underline underline-offset-4"
              href="https://arlequins.github.io/beat-agent/"
              rel="noreferrer"
              target="_blank"
            >
              Beat Agent 열기 <ArrowUpRight className="size-3.5" />
            </a>
          </div>
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <div className="flex items-center gap-2 text-sm font-bold">
              <ClipboardCheck className="size-4 text-[var(--accent-foreground)]" />
              운영 상태
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              저장은 S3 리비전으로 남고, 확정은 GitHub 검토 요청으로 이어집니다.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-300">
              <RefreshCw className="size-3.5" /> immutable workflow
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
