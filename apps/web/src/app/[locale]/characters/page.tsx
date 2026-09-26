import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CharacterGallery } from "~/components/blog/character-gallery";
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
  const text = {
    ko: {
      description: "Arlequin과 Lumen, 사람과 AI 협업자를 소개합니다.",
      title: "두 사람 · Arlequin × Lumen",
    },
    en: {
      description:
        "Meet Arlequin and Lumen, the human and AI collaborator behind this portfolio.",
      title: "Characters · Arlequin × Lumen",
    },
    ja: {
      description:
        "このポートフォリオをつくる人と AI 協働者、Arlequin と Lumen を紹介します。",
      title: "二人の紹介 · Arlequin × Lumen",
    },
  }[locale];
  return {
    alternates: localizedAlternates(locale, "/characters/"),
    description: text.description,
    title: text.title,
  };
}

export default async function LocaleCharactersPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  return <CharacterGallery locale={locale} />;
}
