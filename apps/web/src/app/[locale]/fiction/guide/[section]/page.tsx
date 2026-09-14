import { notFound } from "next/navigation";
import { FictionGuide } from "~/components/blog/fiction-guide-pages";
import { getGuideEntries } from "~/lib/fiction-guide";
import { isLocale, locales } from "~/lib/i18n";
export const dynamicParams = false;
export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  return {
    title: `${(await getGuideEntries()).find((item) => item.slug === section)?.title ?? "설정집"} · 여백의 사람들`,
  };
}
export async function generateStaticParams() {
  const entries = await getGuideEntries();
  return locales.flatMap((locale) =>
    entries.map((item) => ({ locale, section: item.slug })),
  );
}
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; section: string }>;
}) {
  const { locale, section } = await params;
  if (!isLocale(locale)) notFound();
  return <FictionGuide locale={locale} slug={section} />;
}
