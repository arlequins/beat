"use client";

import { Button } from "@acme/ui/button";
import { toast } from "@acme/ui/toast";
import { Link as LinkIcon, PenLine } from "lucide-react";
import Link from "next/link";

export function PostDetailActions(props: { slug: string }) {
  async function copyLink() {
    await navigator.clipboard.writeText(
      `${window.location.origin}/posts/${props.slug}/`,
    );
    toast.success("Post link copied");
  }

  return (
    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
      <Button className="w-full sm:w-auto" onClick={copyLink} variant="outline">
        <LinkIcon aria-hidden="true" />
        Copy link
      </Button>
      <Button asChild className="w-full sm:w-auto">
        <Link href={`/editor/?post=${props.slug}`}>
          <PenLine aria-hidden="true" />
          Edit post
        </Link>
      </Button>
    </div>
  );
}
