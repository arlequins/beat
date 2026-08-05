import type { Metadata } from "next";
import { Suspense } from "react";

import { GourmetBrowser } from "~/components/gourmet/gourmet-browser";
import { localizedAlternates } from "~/lib/seo";

export const metadata: Metadata = {
  alternates: localizedAlternates("ko", "/gourmet/"),
  description: "Beat와 함께 기록하고 Arlequin이 확인한 개인 식사 기록",
  title: "Gourmet 기록",
};

export default function GourmetPage() {
  return (
    <Suspense
      fallback={<p className="p-12 text-center">식탁을 준비하고 있습니다…</p>}
    >
      <GourmetBrowser locale="ko" />
    </Suspense>
  );
}
