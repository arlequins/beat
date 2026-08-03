import type { Metadata } from "next";

import { BeatAdminConsole } from "~/components/admin/beat-admin-console";

export const metadata: Metadata = {
  description: "Beat 관리자 전용 기사 검토 화면",
  robots: { follow: false, index: false },
  title: "Beat 관리자",
};

export default function BeatAdminPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-12 text-[var(--foreground)] sm:px-8">
      <BeatAdminConsole />
    </main>
  );
}
