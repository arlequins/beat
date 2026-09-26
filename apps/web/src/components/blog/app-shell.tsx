"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
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
  const isPostDetail = /^\/(?:(?:ko|en|ja)\/)?posts\/[^/]+\/?$/.test(pathname);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStart = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggered = useRef(false);
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

  useEffect(
    () => () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    },
    [],
  );

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
        ref={menuTriggerRef}
        aria-controls="site-menu"
        aria-label={menuLabel}
        title={menuLabel}
        onPointerDown={(event) => {
          if (event.pointerType !== "touch" || !event.isPrimary) return;
          longPressStart.current = { x: event.clientX, y: event.clientY };
          longPressTimer.current = setTimeout(() => {
            longPressTriggered.current = true;
            menuRef.current?.showPopover();
            menuTriggerRef.current?.focus({ preventScroll: true });
          }, 600);
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            // Pointer capture is not available in every browser context.
          }
        }}
        onPointerMove={(event) => {
          if (event.pointerType !== "touch" || !longPressStart.current) {
            return;
          }
          const distance = Math.hypot(
            event.clientX - longPressStart.current.x,
            event.clientY - longPressStart.current.y,
          );
          if (distance > 12) {
            if (longPressTimer.current) clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
            longPressStart.current = null;
          }
        }}
        onPointerUp={(event) => {
          if (event.pointerType !== "touch") return;
          if (longPressTimer.current) clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
          longPressStart.current = null;
          try {
            event.currentTarget.releasePointerCapture(event.pointerId);
          } catch {
            // The pointer may already have been released by the browser.
          }
        }}
        onPointerCancel={() => {
          if (longPressTimer.current) clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
          longPressStart.current = null;
          longPressTriggered.current = false;
        }}
        onClick={(event) => {
          if (longPressTriggered.current) {
            event.preventDefault();
            event.stopPropagation();
            longPressTriggered.current = false;
            return;
          }
          const menu = menuRef.current;
          if (!menu) return;
          if (menu.matches(":popover-open")) {
            menu.hidePopover();
          } else {
            menu.showPopover();
          }
        }}
        onContextMenu={(event) => {
          event.preventDefault();
        }}
      >
        <Menu aria-hidden="true" size={18} />
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
          <Link
            onClick={() => menuRef.current?.hidePopover()}
            href={localePath(locale, "/characters/")}
            aria-current={route.startsWith("/characters") ? "page" : undefined}
          >
            {text.characters}
          </Link>
        </nav>
        <div className="site-menu-settings">
          <div>
            <span>
              {locale === "ko" ? "언어" : locale === "ja" ? "言語" : "Language"}
            </span>
            <LanguageSwitcher />
          </div>
          <div>
            <span>
              {locale === "ko"
                ? "화면"
                : locale === "ja"
                  ? "表示"
                  : "Appearance"}
            </span>
            <ThemeToggle />
          </div>
        </div>
        <div className="site-menu-contact">
          <a href={siteConfig.links.github} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href={`mailto:${siteConfig.email}`}>{text.email}</a>
        </div>
      </div>
      <main className="site-main">{props.children}</main>
      <footer className="site-footer compact-footer">
        <span>
          © {new Date().getFullYear()} {siteConfig.legalName}
        </span>
        <a href={`mailto:${siteConfig.email}`}>{text.email}</a>
      </footer>
      {isPostDetail ? null : (
        <div className="shell-handoff">
          <BeatChatEntry />
        </div>
      )}
    </div>
  );
}
