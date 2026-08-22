"use client";

import { ExternalLink, ImagePlus, ShieldCheck } from "lucide-react";

const extensionUrl = "https://github.com/arlequins/beat/releases/latest";
const guideUrl =
  "https://github.com/arlequins/beat/blob/main/docs/gourmet-chatgpt-export.md";

export function ChatGPTExportCard() {
  return (
    <section
      aria-labelledby="chatgpt-export-title"
      className="overflow-hidden rounded-3xl border border-[var(--cyan)]/30 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--cyan)_12%,transparent),var(--surface)_52%)]"
      id="chatgpt-export"
    >
      <div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6">
        <div className="flex items-start gap-4">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--night)] text-[var(--cyan)]">
            <ImagePlus className="size-5" />
          </div>
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-[var(--accent-foreground)] uppercase">
              ChatGPT · Gourmet
            </p>
            <h2
              className="mt-1 font-serif text-2xl font-black tracking-[-0.03em]"
              id="chatgpt-export-title"
            >
              대화 속 식사 사진 가져오기
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
              개인용 Chrome 확장이 현재 ChatGPT 대화의 사진을 읽어, 확인한 뒤
              Gourmet 초안에 연결합니다. 새 기록을 자동 발행하지 않습니다.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-bold text-[var(--muted-foreground)]">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-[var(--cyan)]" />
                관리자 세션만 사용
              </span>
              <span>WebP 최적화 · EXIF 제거</span>
              <span>초안 연결 전 확인</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <a
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--foreground)] px-3 py-2.5 text-sm font-bold text-[var(--background)] transition-transform hover:-translate-y-0.5"
            href={extensionUrl}
            rel="noreferrer"
            target="_blank"
          >
            확장 설치 <ExternalLink className="size-3.5" />
          </a>
          <a
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm font-bold transition-colors hover:bg-[var(--background)]"
            href={guideUrl}
            rel="noreferrer"
            target="_blank"
          >
            사용 방법 <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>
    </section>
  );
}
