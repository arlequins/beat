import type { Metadata } from "next";
import { AdminSettings } from "~/components/blog/admin-settings";
import { PageHeader } from "~/components/blog/page-header";

export const metadata: Metadata = { title: "Administration" };

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Administration"
        description="Configure publication defaults, editorial behavior, and security."
      />
      <AdminSettings />
    </div>
  );
}
