import type { Metadata } from "next";
import { Suspense } from "react";

import { PrivateFictionReader } from "~/components/admin/private-fiction-reader";

export const metadata: Metadata = {
  description: "관리자 인증이 필요한 개인 소설 회차 목록",
  robots: { follow: false, index: false },
  title: "회차 목록 · 비공개 소설",
};

export default function PrivateFictionListPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <Suspense fallback={<div className="min-h-[70vh]" />}>
        <PrivateFictionReader />
      </Suspense>
    </div>
  );
}
