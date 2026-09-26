export const locales = ["ko", "en", "ja"] as const;

export type Locale = (typeof locales)[number];

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function localePath(locale: Locale, path = "/") {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (locale === "en") return normalized;
  return normalized === "/" ? `/${locale}/` : `/${locale}${normalized}`;
}

export const copy: Record<Locale, Record<string, string>> = {
  ko: {
    backstage: "Backstage · 제작의 기록",
    brandTagline: "사람의 방향 · AI의 조명",
    characters: "두 사람",
    email: "이메일",
    footer:
      "Arlequin과 Lumen이 함께 묻고 만듭니다. 대화에서 찾은 가능성을 글과 코드로 이어갑니다.",
    gourmet: "Gourmet",
    language: "언어",
    work: "작업",
    writing: "IT 이슈",
    fiction: "소설",
  },
  en: {
    backstage: "Backstage · The making of it",
    brandTagline: "Human direction · AI illumination",
    characters: "Characters",
    email: "Email",
    footer:
      "Arlequin and Lumen ask questions and build together, turning ideas from their conversations into writing and code.",
    gourmet: "Gourmet",
    language: "Language",
    work: "Work",
    writing: "Writing",
    fiction: "Fiction",
  },
  ja: {
    backstage: "Backstage · 制作の記録",
    brandTagline: "人の方向性 · AIの照明",
    characters: "二人の紹介",
    email: "メール",
    footer:
      "ArlequinとLumenがともに問い、つくる。対話で見つけた可能性を、文章とコードへつなげます。",
    gourmet: "Gourmet",
    language: "言語",
    work: "作品",
    writing: "ノート",
    fiction: "小説",
  },
};

export const localeNames: Record<Locale, string> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
};
