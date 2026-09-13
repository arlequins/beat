"use client";

import type { Locale } from "~/lib/i18n";

export function HomeObject({ locale }: { locale: Locale }) {
  const label =
    locale === "ko"
      ? "메뉴 열기"
      : locale === "ja"
        ? "メニューを開く"
        : "Open menu";
  return (
    <div className="home-object-wrap">
      <button
        className="home-object"
        type="button"
        popoverTarget="site-menu"
        aria-label={label}
      >
        <span className="object-folios" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </button>
      <span className="object-hint">{label}</span>
    </div>
  );
}
