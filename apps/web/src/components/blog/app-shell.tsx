"use client";

import { BookOpen, GitBranch, Mail, Utensils } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
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

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  if (pathname.includes("/fiction")) {
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
    <div className="brand-shell">
      <header className="brand-header">
        <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link
            className="flex shrink-0 items-center gap-2 sm:gap-3"
            href={localePath(locale)}
          >
            <BrandMark />
            <span>
              <span className="display-serif block text-sm sm:text-lg font-bold leading-none tracking-[-0.04em]">
                Arlequin <i className="font-normal text-[#d94f38]">×</i> Lumen
              </span>
              <span className="mt-1 block text-[0.6rem] font-semibold tracking-[0.18em] text-slate-500 uppercase">
                {text.brandTagline}
              </span>
            </span>
          </Link>
          <nav
            aria-label="Primary"
            className="flex shrink-0 items-center gap-2 whitespace-nowrap text-xs font-semibold tracking-[0.08em] uppercase sm:gap-4"
          >
            <Link
              className="hidden text-slate-600 transition hover:text-[#d94f38] lg:block"
              href={`${localePath(locale)}#work`}
            >
              {text.work}
            </Link>
            <Link
              className="text-slate-600 transition hover:text-[#d94f38]"
              href={localePath(locale, "/posts/")}
            >
              {text.writing}
            </Link>
            <Link
              aria-label={text.gourmet}
              className="text-slate-600 transition hover:text-[#d94f38]"
              href={localePath(locale, "/gourmet/")}
            >
              <Utensils aria-hidden="true" className="size-5 md:hidden" />
              <span className="hidden md:inline">{text.gourmet}</span>
            </Link>
            <Link
              aria-label={text.fiction}
              aria-current={pathname.includes("/fiction") ? "page" : undefined}
              className="text-slate-600 transition hover:text-[#d94f38]"
              href={localePath(locale, "/fiction/")}
            >
              <BookOpen aria-hidden="true" className="size-5 md:hidden" />
              <span className="hidden md:inline">{text.fiction}</span>
            </Link>
            <LanguageSwitcher />
            <ThemeToggle />
            <a
              aria-label="GitHub"
              className="hidden text-slate-600 transition hover:text-[#d94f38] lg:block"
              href={siteConfig.links.github}
              rel="noreferrer"
              target="_blank"
            >
              <GitBranch aria-hidden="true" className="size-5" />
            </a>
            <a
              aria-label="Email"
              className="hidden text-slate-600 transition hover:text-[#d94f38] lg:block"
              href={`mailto:${siteConfig.email}`}
            >
              <Mail aria-hidden="true" className="size-5" />
            </a>
          </nav>
        </div>
      </header>
      <main>{props.children}</main>
      <footer className="bg-[#111326] px-5 py-12 text-slate-300 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-8 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-3">
              <BrandMark className="brightness-110" />
              <p className="display-serif text-xl text-white">
                Arlequin × Lumen
              </p>
            </div>
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-400">
              {text.footer}
            </p>
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
      <BeatChatEntry />
    </div>
  );
}
