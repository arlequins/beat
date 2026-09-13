import type { Metadata } from "next";
import { HomeIndex } from "~/components/blog/home-index";
import { localizedAlternates } from "~/lib/seo";

export const metadata: Metadata = { alternates: localizedAlternates("en") };
export function KoreanHome() {
  return <HomeIndex locale="ko" />;
}
export default function HomePage() {
  return <HomeIndex locale="en" />;
}
