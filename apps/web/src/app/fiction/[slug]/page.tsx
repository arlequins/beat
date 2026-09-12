import type { Metadata } from "next";
import { FictionDetail } from "~/components/blog/fiction-pages";
import { getStories } from "~/lib/fiction";
export const dynamicParams = false;
export async function generateStaticParams() {
  return (await getStories()).map(({ slug }) => ({ slug }));
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
      "Fiction",
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return <FictionDetail locale="en" slug={(await params).slug} />;
}
