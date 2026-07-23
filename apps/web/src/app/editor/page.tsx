import type { Metadata } from "next";
import { Suspense } from "react";
import { PostEditor } from "~/components/blog/post-editor";

export const metadata: Metadata = { title: "Editor" };

export default function EditorPage() {
  return (
    <Suspense>
      <PostEditor />
    </Suspense>
  );
}
