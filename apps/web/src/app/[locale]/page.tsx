import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KoreanHome } from "~/app/page";
import { LocalizedHome } from "~/components/blog/localized-pages";
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
      title: "포트폴리오와 기술 노트",
      description:
        "AI 협업자 Lumen과 함께 만드는 Arlequin의 소프트웨어 포트폴리오와 기술 노트.",
    },
    en: {
      title: "Portfolio and technical notes",
      description:
        "A software portfolio and technical journal by Arlequin, built with AI collaborator Lumen.",
    },
    ja: {
      title: "ポートフォリオと技術ノート",
      description:
        "AI の協働者 Lumen と Arlequin が作るソフトウェアポートフォリオと技術ノート。",
    },
  }[locale];
  return {
    alternates: localizedAlternates(locale),
    description: copy.description,
    title: copy.title,
  };
}
export default async function LocaleHome(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  if (locale === "ko") return <KoreanHome />;
  return <LocalizedHome locale={locale} />;
}
