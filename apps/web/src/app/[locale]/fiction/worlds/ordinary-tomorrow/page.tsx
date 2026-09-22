import { notFound } from "next/navigation";
import {
  OrdinaryTomorrowGuide,
  ordinaryTomorrowMetadata,
} from "~/components/blog/ordinary-tomorrow-guide";
import { isLocale, locales } from "~/lib/i18n";

export const metadata = ordinaryTomorrowMetadata;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <OrdinaryTomorrowGuide locale={locale} />;
}
