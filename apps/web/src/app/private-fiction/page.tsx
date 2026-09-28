import type { Metadata } from "next";

import { LegacyPrivateFictionRedirect } from "~/components/admin/legacy-private-fiction-redirect";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "비공개 소설 주소 변경",
};

export default function LegacyPrivateFictionPage() {
  return <LegacyPrivateFictionRedirect />;
}
