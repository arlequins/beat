import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FictionIndex } from "~/components/blog/fiction-pages";
import { isLocale, locales } from "~/lib/i18n";
export const dynamicParams = false;
export const metadata: Metadata = {
  title: "소설 · 여백의 사람들",
  description: "하나의 세계, 저마다의 삶. 짧은 판타지 옴니버스.",
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
