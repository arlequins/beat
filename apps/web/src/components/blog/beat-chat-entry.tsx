"use client";

import {
  BotMessageSquare,
  ExternalLink,
  MessageCircleMore,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import {
  BeatAdminSessionEvent,
  hasPersistentBeatAdminSession,
} from "~/lib/beat-admin-session";
import { isLocale, type Locale } from "~/lib/i18n";

const copy: Record<Locale, { action: string; detail: string; label: string }> =
  {
    ko: {
      action: "Beat과 대화하기",
      detail: "대화 · 출처 · 피드백",
      label: "새 창에서 Beat 대화 열기",
    },
    en: {
      action: "Talk with Beat",
      detail: "Conversation · sources · feedback",
      label: "Open Beat chat in a new window",
    },
    ja: {
      action: "Beat と話す",
      detail: "対話 · 出典 · フィードバック",
      label: "新しいウィンドウで Beat の対話を開く",
    },
  };

/**
 * Opens the separately hosted Beat application instead of embedding it.
 * Beat owns its OIDC session and all conversation data; this static site only
 * exposes a public destination URL at build time.
 */
export function BeatChatEntry() {
  const [authenticated, setAuthenticated] = useState(false);
  const pathname = usePathname() ?? "/";
  const firstSegment = pathname.split("/")[1] ?? "";
  const locale: Locale = isLocale(firstSegment)
    ? firstSegment
    : pathname === "/"
      ? "en"
      : "ko";
  const text = copy[locale];
  const destination = process.env.NEXT_PUBLIC_BEAT_APP_URL?.trim();

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

  if (!destination || !authenticated) return null;

  return (
    <a
      aria-label={text.label}
      className="fixed right-4 bottom-4 z-50 flex size-12 items-center justify-center border border-[#f6c85f]/70 bg-[#111326] text-white shadow-[0.3rem_0.3rem_0_#f06449] transition hover:-translate-y-1 hover:border-[#79e6e0] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#79e6e0] sm:right-8 sm:bottom-8 sm:h-auto sm:w-auto sm:justify-start sm:gap-3 sm:px-4 sm:py-3 sm:shadow-[0.35rem_0.35rem_0_#f06449]"
      href={destination}
      rel="noopener noreferrer"
      target="_blank"
    >
      <span className="flex size-9 items-center justify-center bg-[#f06449] text-white sm:size-9">
        <BotMessageSquare aria-hidden="true" className="size-5" />
      </span>
      <span className="hidden min-w-0 sm:block">
        <span className="flex items-center gap-1 text-sm font-bold">
          {text.action}
          <ExternalLink aria-hidden="true" className="size-3.5" />
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-[0.65rem] font-semibold tracking-[0.08em] text-[#79e6e0] uppercase">
          <MessageCircleMore aria-hidden="true" className="size-3" />
          {text.detail}
        </span>
      </span>
    </a>
  );
}
