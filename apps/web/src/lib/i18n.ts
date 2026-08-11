export const locales = ["ko", "en", "ja"] as const;

export type Locale = (typeof locales)[number];

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function localePath(locale: Locale, path = "/") {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (locale === "ko") return normalized === "/" ? "/ko/" : normalized;
  return normalized === "/" ? `/${locale}/` : `/${locale}${normalized}`;
}

export const copy: Record<Locale, Record<string, string>> = {
  ko: {
    backstage: "Backstage · 제작의 기록",
    brandTagline: "사람의 방향 · AI의 조명",
    email: "이메일",
    footer:
      "Arlequin이 방향을 결정하고, Lumen이 가능성과 맥락을 비춥니다. 모든 결과는 사람의 검토를 거쳐 완성됩니다.",
    gourmet: "Gourmet",
    language: "언어",
    work: "작업",
    writing: "글",
  },
  en: {
    backstage: "Backstage · The making of it",
    brandTagline: "Human direction · AI illumination",
    email: "Email",
    footer:
      "Arlequin chooses the direction; Lumen illuminates the possibilities and context. Every result is completed through human review.",
    gourmet: "Gourmet",
    language: "Language",
    work: "Work",
    writing: "Writing",
  },
  ja: {
    backstage: "Backstage · 制作の記録",
    brandTagline: "人の方向性 · AIの照明",
    email: "メール",
    footer:
      "Arlequinが方向を決め、Lumenが可能性と文脈を照らします。すべての成果は人のレビューを経て完成します。",
    gourmet: "Gourmet",
    language: "言語",
    work: "作品",
    writing: "ノート",
  },
};

export const localeNames: Record<Locale, string> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
};
