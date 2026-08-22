"use client";

import {
  BotMessageSquare,
  ExternalLink,
  MessageCircleMore,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  BeatAdminSessionEvent,
  hasPersistentBeatAdminSession,
} from "~/lib/beat-admin-session";
import { isLocale, type Locale } from "~/lib/i18n";

const copy: Record<
  Locale,
  {
    action: string;
    cancel: string;
    confirm: string;
    detail: string;
    handoffAction: string;
    handoffDetail: string;
    label: string;
    privacy: string;
    reviewTitle: string;
  }
> = {
  ko: {
    action: "Beat과 대화하기",
    cancel: "취소",
    confirm: "확인하고 Beat 열기",
    detail: "대화 · 출처 · 피드백",
    handoffAction: "이 글을 Beat에게 묻기",
    handoffDetail: "제목 · 주소 · 발췌 확인",
    label: "새 창에서 Beat 대화 열기",
    privacy:
      "확인하면 아래 공개 글 정보만 Beat의 질문 입력란으로 전달됩니다. 로그인 정보와 다른 브라우저 데이터는 전달하지 않습니다.",
    reviewTitle: "Beat에 전달할 내용을 확인하세요",
  },
  en: {
    action: "Talk with Beat",
    cancel: "Cancel",
    confirm: "Confirm and open Beat",
    detail: "Conversation · sources · feedback",
    handoffAction: "Ask Beat about this post",
    handoffDetail: "Review title · URL · excerpt",
    label: "Open Beat chat in a new window",
    privacy:
      "Only the public post details below will be copied into Beat's question box. Login details and other browser data are not shared.",
    reviewTitle: "Review what will be sent to Beat",
  },
  ja: {
    action: "Beat と話す",
    cancel: "キャンセル",
    confirm: "確認して Beat を開く",
    detail: "対話 · 出典 · フィードバック",
    handoffAction: "この記事を Beat に聞く",
    handoffDetail: "タイトル · URL · 抜粋を確認",
    label: "新しいウィンドウで Beat の対話を開く",
    privacy:
      "以下の公開記事情報だけが Beat の質問欄に渡されます。ログイン情報や他のブラウザデータは共有されません。",
    reviewTitle: "Beat に渡す内容を確認してください",
  },
};

type BlogContext = { excerpt: string; title: string; url: string };

export function beatHandoffUrl(destination: string, context: BlogContext) {
  const url = new URL(destination);
  url.searchParams.set("handoff", "beat-blog");
  url.searchParams.set("title", context.title.slice(0, 200));
  url.searchParams.set("url", context.url.slice(0, 2_000));
  url.searchParams.set("excerpt", context.excerpt.slice(0, 1_500));
  return url.toString();
}

/**
 * Opens the separately hosted Beat application instead of embedding it.
 * Beat owns its OIDC session and all conversation data; this static site only
 * exposes a public destination URL at build time.
 */
export function BeatChatEntry() {
  const [authenticated, setAuthenticated] = useState(false);
  const [blogContext, setBlogContext] = useState<BlogContext>();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname() ?? "/";
  const firstSegment = pathname.split("/")[1] ?? "";
  const locale: Locale = isLocale(firstSegment) ? firstSegment : "en";
  const text = copy[locale];
  const destination = process.env.NEXT_PUBLIC_BEAT_APP_URL?.trim();
  const isPost = /^\/(?:(?:ko|en|ja)\/)?posts\/[^/]+\/?$/.test(pathname);

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

  useEffect(() => {
    if (!blogContext) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setBlogContext(undefined);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    cancelButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [blogContext]);

  if (!destination || !authenticated) return null;

  const entryClassName =
    "fixed right-4 bottom-4 z-50 flex size-12 items-center justify-center border border-[#f6c85f]/70 bg-[#111326] text-white shadow-[0.3rem_0.3rem_0_#f06449] transition hover:-translate-y-1 hover:border-[#79e6e0] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#79e6e0] sm:right-8 sm:bottom-8 sm:h-auto sm:w-auto sm:justify-start sm:gap-3 sm:px-4 sm:py-3 sm:shadow-[0.35rem_0.35rem_0_#f06449]";
  const entryContent = (
    <>
      <span className="flex size-9 items-center justify-center bg-[#f06449] text-white sm:size-9">
        <BotMessageSquare aria-hidden="true" className="size-5" />
      </span>
      <span className="hidden min-w-0 sm:block">
        <span className="flex items-center gap-1 text-sm font-bold">
          {isPost ? text.handoffAction : text.action}
          <ExternalLink aria-hidden="true" className="size-3.5" />
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-[0.65rem] font-semibold tracking-[0.08em] text-[#79e6e0] uppercase">
          <MessageCircleMore aria-hidden="true" className="size-3" />
          {isPost ? text.handoffDetail : text.detail}
        </span>
      </span>
    </>
  );

  if (!isPost)
    return (
      <a
        aria-label={text.label}
        className={entryClassName}
        href={destination}
        rel="noopener noreferrer"
        target="_blank"
      >
        {entryContent}
      </a>
    );

  return (
    <>
      <button
        aria-label={text.handoffAction}
        className={entryClassName}
        onClick={() => {
          const title = document
            .querySelector<HTMLElement>("[data-beat-context-title]")
            ?.innerText.trim();
          const excerpt = document
            .querySelector<HTMLElement>("[data-beat-context-excerpt]")
            ?.innerText.trim();
          if (!title) return;
          setBlogContext({
            excerpt: excerpt ?? "",
            title,
            url: window.location.href,
          });
        }}
        type="button"
      >
        {entryContent}
      </button>
      {blogContext ? (
        <div
          aria-labelledby="beat-handoff-title"
          aria-modal="true"
          className="fixed inset-0 z-[60] grid place-items-center bg-[#111326]/75 px-5 backdrop-blur-sm"
          role="dialog"
        >
          <div className="w-full max-w-xl border border-[#f6c85f]/60 bg-[#fffdf6] p-6 text-[#111326] shadow-[0.6rem_0.6rem_0_#f06449] sm:p-8">
            <h2
              className="display-serif text-2xl font-bold"
              id="beat-handoff-title"
            >
              {text.reviewTitle}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {text.privacy}
            </p>
            <dl className="mt-6 space-y-4 border-y border-slate-200 py-5 text-sm">
              <div>
                <dt className="font-bold">Title</dt>
                <dd className="mt-1 text-slate-600">{blogContext.title}</dd>
              </div>
              <div>
                <dt className="font-bold">URL</dt>
                <dd className="mt-1 break-all text-slate-600">
                  {blogContext.url}
                </dd>
              </div>
              <div>
                <dt className="font-bold">Excerpt</dt>
                <dd className="mt-1 line-clamp-4 text-slate-600">
                  {blogContext.excerpt}
                </dd>
              </div>
            </dl>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                className="border border-slate-300 px-4 py-3 text-sm font-bold hover:border-slate-600"
                onClick={() => setBlogContext(undefined)}
                ref={cancelButtonRef}
                type="button"
              >
                {text.cancel}
              </button>
              <a
                className="bg-[#111326] px-4 py-3 text-center text-sm font-bold text-white hover:bg-[#f06449]"
                href={beatHandoffUrl(destination, blogContext)}
                rel="noopener noreferrer"
                target="_blank"
              >
                {text.confirm}
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function BeatPostAssistantCard(props: {
  excerpt: string;
  locale: Locale;
  title: string;
}) {
  const destination = process.env.NEXT_PUBLIC_BEAT_APP_URL?.trim();
  const pathname = usePathname() ?? "/";
  const [href, setHref] = useState<string>();
  const copy = {
    en: {
      action: "Ask Beat about this post",
      detail:
        "Carry the title, source page, and excerpt into a private conversation.",
      eyebrow: "Lumen / context handoff",
    },
    ja: {
      action: "この記事を Beat に聞く",
      detail: "タイトル、出典ページ、抜粋をプライベートな対話へ渡します。",
      eyebrow: "Lumen / コンテキスト引き継ぎ",
    },
    ko: {
      action: "이 글을 Beat에게 묻기",
      detail: "제목·출처 페이지·발췌만 확인한 뒤 비공개 대화로 이어갑니다.",
      eyebrow: "Lumen / 맥락 연결",
    },
  }[props.locale];

  useEffect(() => {
    if (!destination) return;
    setHref(
      beatHandoffUrl(destination, {
        excerpt: props.excerpt,
        title: props.title,
        url: new URL(pathname, window.location.origin).toString(),
      }),
    );
  }, [destination, pathname, props.excerpt, props.title]);

  if (!destination || !href) return null;
  return (
    <aside className="mt-14 border border-[#79e6e0]/45 bg-[#111326] p-5 text-white shadow-[0.45rem_0.45rem_0_#f06449] sm:p-6">
      <p className="brand-eyebrow text-[#79e6e0]">{copy.eyebrow}</p>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-xl text-sm leading-6 text-slate-300">
          {copy.detail}
        </p>
        <a
          className="inline-flex shrink-0 items-center justify-center gap-2 bg-[#f06449] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#d94f38]"
          href={href}
          rel="noopener noreferrer"
          target="_blank"
        >
          <MessageCircleMore aria-hidden="true" className="size-4" />
          {copy.action}
          <ExternalLink aria-hidden="true" className="size-3.5" />
        </a>
      </div>
    </aside>
  );
}
