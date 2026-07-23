import type { Metadata } from "next";
import { PageHeader } from "~/components/blog/page-header";
import { UserManagementView } from "~/components/blog/user-management-view";

export const metadata: Metadata = { title: "Users" };

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Team"
        title="User management"
        description="Manage access, roles, and invitations for your publication."
      />
      <UserManagementView />
    </div>
  );
}
