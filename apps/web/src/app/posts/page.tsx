import type { Metadata } from "next";
import { PageHeader } from "~/components/blog/page-header";
import { CreateContentButton } from "~/components/content/content-actions";
import { ContentList } from "~/components/content/content-list";

export const metadata: Metadata = { title: "Posts" };

export default function PostsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Content"
        description="A complete CRUD example with search, sorting, pagination, and permission-aware actions."
        actions={<CreateContentButton />}
      />
      <ContentList />
    </div>
  );
}
