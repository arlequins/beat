import type { Metadata } from "next";

import { PrivateFictionReader } from "~/components/admin/private-fiction-reader";

export const metadata: Metadata = {
  description: "계정 인증이 필요한 개인 원고 보관함",
  robots: { follow: false, index: false },
  title: "비공개 원고 보관함",
};

export default function PrivateFictionPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-12 text-[var(--foreground)] sm:px-8">
      <PrivateFictionReader />
    </main>
  );
}
