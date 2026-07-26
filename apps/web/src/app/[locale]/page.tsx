import { notFound } from "next/navigation";

import { LocalizedHome } from "~/components/blog/localized-pages";
import { isLocale, locales } from "~/lib/i18n";

export const dynamicParams = false;
export function generateStaticParams() {
  return locales
    .filter((locale) => locale !== "ko")
    .map((locale) => ({ locale }));
}
export default async function LocaleHome(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  if (!isLocale(locale) || locale === "ko") notFound();
  return <LocalizedHome locale={locale} />;
}
