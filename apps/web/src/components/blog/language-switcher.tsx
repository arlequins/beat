"use client";

import { Languages } from "lucide-react";
import { usePathname } from "next/navigation";

import {
  isLocale,
  type Locale,
  localeNames,
  localePath,
  locales,
} from "~/lib/i18n";

function currentLocale(pathname: string): Locale {
  const segment = pathname.split("/")[1] ?? "";
  return isLocale(segment) && segment !== "ko" ? segment : "ko";
}

function withoutLocale(pathname: string) {
  const segment = pathname.split("/")[1] ?? "";
  if (isLocale(segment) && segment !== "ko") {
    return pathname.replace(new RegExp(`^/${segment}`), "") || "/";
  }
  return pathname || "/";
}

function localeFromSelection(value: string): Locale | undefined {
  switch (value) {
    case "ko":
      return "ko";
    case "en":
      return "en";
    case "ja":
      return "ja";
    default:
      return undefined;
  }
}

export function LanguageSwitcher() {
  const pathname = usePathname() ?? "/";
  const locale = currentLocale(pathname);
  const basePath = withoutLocale(pathname);

  return (
    <div className="relative block">
      <label className="sr-only" htmlFor="language-switcher">
        Language
      </label>
      <Languages
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-slate-500"
      />
      <select
        className="appearance-none border border-slate-900/15 bg-transparent py-1.5 pr-2 pl-7 text-[0.66rem] font-bold tracking-[0.07em] text-slate-700 uppercase outline-none transition hover:border-[#d94f38]"
        defaultValue={locale}
        id="language-switcher"
        onChange={(event) => {
          const nextLocale = localeFromSelection(event.currentTarget.value);
          if (nextLocale) {
            window.location.assign(localePath(nextLocale, basePath));
          }
        }}
      >
        {locales.map((item) => (
          <option key={item} value={item}>
            {localeNames[item]}
          </option>
        ))}
      </select>
    </div>
  );
}
