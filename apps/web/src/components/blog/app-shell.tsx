"use client";

import { Ellipsis } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { BrandMark } from "~/components/blog/brand-mark";
import { LanguageSwitcher } from "~/components/blog/language-switcher";
import { ThemeToggle } from "~/components/blog/theme-toggle";
import { siteConfig } from "~/config/site";
import { BeatChatEntry } from "~/features/beat-handoff/ui/beat-chat-entry";
import { copy, isLocale, type Locale, localePath } from "~/lib/i18n";

export function AppShell(props: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const segment = pathname.split("/")[1] ?? "";
  const locale: Locale = isLocale(segment) ? segment : "en";
  const text = copy[locale];
  const menuRef = useRef<HTMLDivElement>(null);
  const menuLabel =
    locale === "ko"
      ? "메뉴 및 설정"
      : locale === "ja"
        ? "メニューと設定"
        : "Menu and settings";
  const route =
    (isLocale(segment) ? pathname.slice(segment.length + 1) : pathname) || "/";

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  if (route === "/fiction" || route.startsWith("/fiction/")) {
    if (pathname.split("/fiction/")[1]) return <main>{props.children}</main>;
    return (
      <div className="ebook-shell">
        <header className="ebook-toolbar">
          <nav aria-label="Primary">
            <Link href={localePath(locale)}>Beat</Link>
            <Link href={localePath(locale, "/posts/")}>{text.writing}</Link>
            <Link href={localePath(locale, "/gourmet/")}>{text.gourmet}</Link>
            <Link href={localePath(locale, "/fiction/")} aria-current="page">
              {text.fiction}
            </Link>
          </nav>
          <ThemeToggle />
        </header>
        <main>{props.children}</main>
      </div>
    );
  }

  return (
    <div className={`brand-shell ${route === "/" ? "index-shell" : ""}`}>
      <button
        type="button"
        className="site-menu-trigger"
        popoverTarget="site-menu"
        aria-label={menuLabel}
        title={menuLabel}
      >
        <Ellipsis aria-hidden="true" size={18} />
      </button>
      <div
        className="site-menu-panel"
        id="site-menu"
        key={pathname}
        popover="auto"
        ref={menuRef}
      >
        <nav aria-label={menuLabel}>
          <Link
            onClick={() => menuRef.current?.hidePopover()}
            href={localePath(locale)}
            aria-current={route === "/" ? "page" : undefined}
          >
            {locale === "ko" ? "홈" : locale === "ja" ? "ホーム" : "Home"}
          </Link>
          <Link
            onClick={() => menuRef.current?.hidePopover()}
            href={`${localePath(locale)}#work`}
          >
            {text.work}
          </Link>
          <Link
            onClick={() => menuRef.current?.hidePopover()}
            href={localePath(locale, "/posts/")}
            aria-current={route.startsWith("/posts/") ? "page" : undefined}
          >
            {text.writing}
          </Link>
          <Link
            onClick={() => menuRef.current?.hidePopover()}
            href={localePath(locale, "/gourmet/")}
            aria-current={route.startsWith("/gourmet/") ? "page" : undefined}
          >
            {text.gourmet}
          </Link>
          <Link
            onClick={() => menuRef.current?.hidePopover()}
            href={localePath(locale, "/fiction/")}
          >
            {text.fiction}
          </Link>
        </nav>
        <div className="site-menu-settings">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
        <div className="site-menu-contact">
          <a href={siteConfig.links.github} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href={`mailto:${siteConfig.email}`}>{text.email}</a>
        </div>
      </div>
      <main className="site-main">{props.children}</main>
      <footer className="site-footer bg-[#111326] px-5 py-8 text-slate-300 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-8 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-3">
              <BrandMark className="brightness-110" />
              <p className="display-serif text-xl text-white">
                Arlequin × Lumen
              </p>
            </div>
          </div>
          <a
            className="text-sm font-semibold text-[#79e6e0] hover:text-white"
            href={`mailto:${siteConfig.email}`}
          >
            {siteConfig.email}
          </a>
        </div>
        <div className="mx-auto mt-10 max-w-6xl border-t border-white/10 pt-5 text-xs text-[#b9c2d5]">
          © {new Date().getFullYear()} {siteConfig.legalName} · Arlequin × Lumen
        </div>
      </footer>
      <div className="shell-handoff">
        <BeatChatEntry />
      </div>
    </div>
  );
}
