import type { Metadata } from "next";
import { Suspense } from "react";
import { localizedAlternates } from "~/lib/seo";
import { GourmetBrowser } from "~/widgets/gourmet-browser/ui/gourmet-browser";

export const metadata: Metadata = {
  alternates: localizedAlternates("en", "/gourmet/"),
  description:
    "Meals, discoveries, and personal restaurant notes recorded with Beat and reviewed by Arlequin.",
  title: "Gourmet notes",
};

export function KoreanGourmetPage() {
  return (
    <Suspense
      fallback={<p className="p-12 text-center">식탁을 준비하고 있습니다…</p>}
    >
      <GourmetBrowser locale="ko" />
    </Suspense>
  );
}

export default function GourmetPage() {
  return (
    <Suspense fallback={<p className="p-12 text-center">Loading…</p>}>
      <GourmetBrowser locale="en" />
    </Suspense>
  );
}
