import { FictionGuide } from "~/components/blog/fiction-guide-pages";
import { getGuideEntries } from "~/lib/fiction-guide";
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
  return (await getGuideEntries()).map((item) => ({ section: item.slug }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  return <FictionGuide locale="en" slug={(await params).section} />;
}
