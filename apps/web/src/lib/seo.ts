import type { Metadata } from "next";

import { type Locale, localePath } from "~/lib/i18n";

function normalizePath(path: string) {
  const prefixed = path.startsWith("/") ? path : `/${path}`;
  return prefixed.endsWith("/") ? prefixed : `${prefixed}/`;
}

/**
 * Keep canonical and hreflang metadata in one place so every static locale
 * describes the English default, Korean, and Japanese alternatives.
 */
export function localizedAlternates(
  locale: Locale,
  path = "/",
): Metadata["alternates"] {
  const normalizedPath = normalizePath(path);
  const href = (targetLocale: Locale) =>
    localePath(targetLocale, normalizedPath);

  return {
    canonical: href(locale),
    languages: {
      en: href("en"),
      ja: href("ja"),
      ko: href("ko"),
      "x-default": href("en"),
    },
  };
}
