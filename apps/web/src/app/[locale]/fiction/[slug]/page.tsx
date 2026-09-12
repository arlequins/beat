import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FictionDetail } from "~/components/blog/fiction-pages";
import { getStories } from "~/lib/fiction";
import { isLocale, locales } from "~/lib/i18n";
export const dynamicParams = false;
export async function generateStaticParams() {
  const stories = await getStories();
  return locales.flatMap((locale) =>
    stories.map(({ slug }) => ({ locale, slug })),
  );
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title:
      (await getStories()).find((story) => story.slug === slug)?.title ??
      "여백의 사람들",
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  return <FictionDetail locale={locale} slug={slug} />;
}
