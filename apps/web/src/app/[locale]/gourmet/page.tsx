import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { KoreanGourmetPage } from "~/app/gourmet/page";
import { isLocale, locales } from "~/lib/i18n";
import { localizedAlternates } from "~/lib/seo";
import { GourmetBrowser } from "~/widgets/gourmet-browser/ui/gourmet-browser";

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
      title: "Gourmet 기록",
      description: "Beat와 기록하고 Arlequin이 확인한 개인 식사 기록.",
    },
    en: {
      title: "Gourmet notes",
      description:
        "Meals, discoveries, and personal restaurant notes recorded with Beat and reviewed by Arlequin.",
    },
    ja: {
      title: "Gourmetノート",
      description: "Beatと記録し、Arlequinが確認した食事とレストランのノート。",
    },
  }[locale];
  return {
    alternates: localizedAlternates(locale, "/gourmet/"),
    description: copy.description,
    title: copy.title,
  };
}
export default async function LocaleGourmetPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  if (locale === "ko") return <KoreanGourmetPage />;
  return (
    <Suspense fallback={<p className="p-12 text-center">Loading…</p>}>
      <GourmetBrowser locale={locale} />
    </Suspense>
  );
}
