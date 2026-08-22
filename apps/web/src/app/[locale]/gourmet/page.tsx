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
  return {
    alternates: localizedAlternates(locale, "/gourmet/"),
    title: "Gourmet",
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
