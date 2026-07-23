import { Button } from "@acme/ui/button";
import { ArrowLeft, Eye, MessageSquare, Timer } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PostDetailActions } from "~/components/blog/post-detail-actions";
import { StatusBadge } from "~/components/blog/status-badge";
import { blogPosts, findBlogPost, formatCompactNumber } from "~/lib/blog-data";

export const dynamicParams = false;

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const post = findBlogPost((await props.params).slug);
  return { title: post?.title ?? "Post" };
}

export default async function PostDetailPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const post = findBlogPost((await props.params).slug);
  if (!post) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild variant="ghost">
          <Link href="/posts/">
            <ArrowLeft aria-hidden="true" />
            All posts
          </Link>
        </Button>
        <PostDetailActions slug={post.slug} />
      </div>

      <article className="bg-background overflow-hidden rounded-lg border">
        <div className="relative aspect-[4/3] w-full sm:aspect-[16/7]">
          <Image
            alt="Editorial feature"
            className="object-cover"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 1100px"
            src={post.image}
          />
        </div>
        <div className="mx-auto max-w-4xl px-5 py-7 sm:px-8 sm:py-9 lg:py-12">
          <div className="mb-5 flex flex-wrap items-center gap-3 text-sm">
            <StatusBadge label={post.status} />
            <span className="text-muted-foreground">{post.category}</span>
          </div>
          <h1 className="max-w-3xl text-[1.75rem] font-semibold leading-tight sm:text-4xl">
            {post.title}
          </h1>
          <p className="text-muted-foreground mt-4 max-w-3xl text-lg leading-8">
            {post.excerpt}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 border-y py-4 text-sm">
            <span className="font-medium">{post.author}</span>
            <span className="text-muted-foreground">{post.publishedAt}</span>
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Timer aria-hidden="true" className="size-4" />
              {post.readTime}
            </span>
          </div>
          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="space-y-5 text-base leading-8">
              {post.content.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <aside
              aria-label="Post performance"
              className="h-fit border-t pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5"
            >
              <h2 className="text-sm font-semibold">Performance</h2>
              <dl className="mt-4 grid grid-cols-2 gap-4 lg:block lg:space-y-4">
                <div>
                  <dt className="text-muted-foreground flex items-center gap-2 text-xs">
                    <Eye className="size-4" />
                    Views
                  </dt>
                  <dd className="mt-1 text-xl font-semibold">
                    {formatCompactNumber(post.views)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground flex items-center gap-2 text-xs">
                    <MessageSquare className="size-4" />
                    Comments
                  </dt>
                  <dd className="mt-1 text-xl font-semibold">
                    {post.comments}
                  </dd>
                </div>
              </dl>
            </aside>
          </div>
        </div>
      </article>
    </div>
  );
}
