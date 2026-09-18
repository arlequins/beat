import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { KoreanPostsPage } from "~/app/posts/page";
import { LocalizedPostsPage } from "~/components/blog/localized-pages";
import { isLocale, locales } from "~/lib/i18n";
import { localizedAlternates } from "~/lib/seo";

export const dynamicParams = false;
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}
export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  if (!isLocale(locale)) return {};
  const copy = {
    ko: {
      title: "IT 이슈 · Lumen",
      description: "제품 개발과 웹 기술에 대한 글과 주간 IT 브리핑.",
    },
    en: {
      title: "Writing · Lumen",
      description:
        "Notes on product engineering, web platforms, and AI-assisted development.",
    },
    ja: {
      title: "ITノート · Lumen",
      description: "製品開発、ウェブ技術、AI 協働に関するノート。",
    },
  }[locale];
  return {
    alternates: localizedAlternates(locale, "/posts/"),
    description: copy.description,
    title: copy.title,
  };
}

export default async function LocalePostsPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  if (locale === "ko") return <KoreanPostsPage />;
  return <LocalizedPostsPage locale={locale} />;
}
