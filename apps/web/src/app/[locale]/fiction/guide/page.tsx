import { notFound } from "next/navigation";
import { FictionGuide } from "~/components/blog/fiction-guide-pages";
import { isLocale, locales } from "~/lib/i18n";
export const metadata = {
  title: "설정집 · 여백의 사람들",
  description: "세계관, 지도, 국가, 인물과 한국어 문체를 정리한 안내",
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
  return <FictionGuide locale={locale} />;
}
