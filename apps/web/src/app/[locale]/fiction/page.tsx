import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FictionIndex } from "~/components/blog/fiction-pages";
import { isLocale, locales } from "~/lib/i18n";
export const dynamicParams = false;
export const metadata: Metadata = {
  title: "소설 목록",
  description: "서로 다른 세계와 사람들의 이야기를 골라 읽는 소설 목록.",
};
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
  return <FictionIndex locale={locale} />;
}
