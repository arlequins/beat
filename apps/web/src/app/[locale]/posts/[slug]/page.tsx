import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { KoreanPostDetailPage } from "~/app/posts/[slug]/page";
import { LocalizedPostDetail } from "~/components/blog/localized-pages";
import { isLocale, locales } from "~/lib/i18n";
import { getPosts } from "~/lib/posts";
import { localizedAlternates } from "~/lib/seo";

export const dynamicParams = false;
export async function generateStaticParams() {
  const posts = await getPosts();
  return locales.flatMap((locale) =>
    posts.map((post) => ({ locale, slug: post.slug })),
  );
}
export async function generateMetadata(props: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await props.params;
  if (!isLocale(locale)) return {};
  return { alternates: localizedAlternates(locale, `/posts/${slug}/`) };
}
export default async function LocalePostPage(props: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await props.params;
  if (!isLocale(locale)) notFound();
  if (locale === "ko")
    return <KoreanPostDetailPage params={Promise.resolve({ slug })} />;
  const page = await LocalizedPostDetail({ locale, slug });
  if (!page) notFound();
  return page;
}
