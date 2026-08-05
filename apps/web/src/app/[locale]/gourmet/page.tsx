import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { GourmetBrowser } from "~/components/gourmet/gourmet-browser";
import { isLocale, locales } from "~/lib/i18n";
import { localizedAlternates } from "~/lib/seo";

export const dynamicParams = false;
export function generateStaticParams() {
  return locales
    .filter((locale) => locale !== "ko")
    .map((locale) => ({ locale }));
}
export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  if (!isLocale(locale) || locale === "ko") return {};
  return {
    alternates: localizedAlternates(locale, "/gourmet/"),
    title: "Gourmet",
  };
}
export default async function LocaleGourmetPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  if (!isLocale(locale) || locale === "ko") notFound();
  return (
    <Suspense fallback={<p className="p-12 text-center">Loading…</p>}>
      <GourmetBrowser locale={locale} />
    </Suspense>
  );
}
