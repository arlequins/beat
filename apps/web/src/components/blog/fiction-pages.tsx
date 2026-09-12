import { notFound } from "next/navigation";
import {
  FictionLibrary,
  FictionViewer,
} from "~/components/blog/fiction-experience";
import { getStories, getStory } from "~/lib/fiction";
import type { Locale } from "~/lib/i18n";

export async function FictionIndex({ locale }: { locale: Locale }) {
  return <FictionLibrary locale={locale} stories={await getStories()} />;
}
export async function FictionDetail({
  locale,
  slug,
}: {
  locale: Locale;
  slug: string;
}) {
  const story = await getStory(slug);
  if (!story) notFound();
  const { content, ...summary } = story;
  return (
    <FictionViewer
      key={slug}
      locale={locale}
      story={summary}
      stories={await getStories()}
    >
      {content}
    </FictionViewer>
  );
}
