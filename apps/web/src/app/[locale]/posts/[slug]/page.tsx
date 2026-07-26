import { notFound } from "next/navigation";

import { LocalizedPostDetail } from "~/components/blog/localized-pages";
import { isLocale, locales } from "~/lib/i18n";
import { getPosts } from "~/lib/posts";

export const dynamicParams = false;
export async function generateStaticParams() {
  const posts = await getPosts();
  return locales
    .filter((locale) => locale !== "ko")
    .flatMap((locale) => posts.map((post) => ({ locale, slug: post.slug })));
}
export default async function LocalePostPage(props: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await props.params;
  if (!isLocale(locale) || locale === "ko") notFound();
  const page = await LocalizedPostDetail({ locale, slug });
  if (!page) notFound();
  return page;
}
