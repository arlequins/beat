import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LocalizedPostsPage } from "~/components/blog/localized-pages";
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
  return { alternates: localizedAlternates(locale, "/posts/") };
}

export default async function LocalePostsPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  if (!isLocale(locale) || locale === "ko") notFound();
  return <LocalizedPostsPage locale={locale} />;
}
