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
  return { alternates: localizedAlternates(locale) };
}
export default async function LocaleHome(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  if (locale === "ko") return <KoreanHome />;
  return <LocalizedHome locale={locale} />;
}
