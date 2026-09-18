import type { Metadata } from "next";

import { LocalizedPostsPage } from "~/components/blog/localized-pages";
import { localizedAlternates } from "~/lib/seo";

export const metadata: Metadata = {
  alternates: localizedAlternates("en", "/posts/"),
  title: "Writing · Lumen",
  description:
    "Notes on product engineering, web platforms, and AI-assisted development.",
};

export async function KoreanPostsPage() {
  return <LocalizedPostsPage locale="ko" />;
}

export default function PostsPage() {
  return <LocalizedPostsPage locale="en" />;
}
