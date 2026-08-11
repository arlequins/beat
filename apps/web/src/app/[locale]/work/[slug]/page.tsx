import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { KoreanWorkDetailPage } from "~/app/work/[slug]/page";
import { LocalizedWorkDetail } from "~/components/blog/localized-pages";
import { projects } from "~/lib/blog-data";
import { isLocale, locales } from "~/lib/i18n";
import { localizedAlternates } from "~/lib/seo";

export const dynamicParams = false;
export function generateStaticParams() {
  return locales.flatMap((locale) =>
    projects.map((project) => ({ locale, slug: project.slug })),
  );
}
export async function generateMetadata(props: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await props.params;
  if (!isLocale(locale)) return {};
  return { alternates: localizedAlternates(locale, `/work/${slug}/`) };
}
export default async function LocaleWorkPage(props: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await props.params;
  if (!isLocale(locale)) notFound();
  if (locale === "ko")
    return <KoreanWorkDetailPage params={Promise.resolve({ slug })} />;
  const page = await LocalizedWorkDetail({ locale, slug });
  if (!page) notFound();
  return page;
}
