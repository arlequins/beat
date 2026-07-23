import { Button } from "@acme/ui/button";
import {
  ArrowUpRight,
  CalendarClock,
  Eye,
  FileText,
  MessageSquare,
  PenLine,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { PageHeader } from "~/components/blog/page-header";
import { StatBlock } from "~/components/blog/stat-block";
import { StatusBadge } from "~/components/blog/status-badge";
import { siteConfig } from "~/config/site";
import { blogPosts, formatCompactNumber } from "~/lib/blog-data";

export const metadata: Metadata = { title: "Dashboard" };

const weeklyViews = [42, 57, 48, 71, 63, 84, 78];

export default function DashboardPage() {
  return (
    <div className="space-y-6 lg:space-y-7">
      <PageHeader
        eyebrow="Wednesday, July 22"
        title={`Welcome to ${siteConfig.name}`}
        description="Here is what is happening across your publication today."
        actions={
          <Button asChild>
            <Link href="/editor/">
              <PenLine aria-hidden="true" />
              New post
            </Link>
          </Button>
        }
      />

      <section
        aria-label="Publication overview"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <StatBlock
          change="+12.4% from last month"
          icon={Eye}
          label="Monthly views"
          tone="blue"
          value="42.8K"
        />
        <StatBlock
          change="4 waiting for review"
          icon={FileText}
          label="Published posts"
          tone="pink"
          value="128"
        />
        <StatBlock
          change="+38 this month"
          icon={Users}
          label="Subscribers"
          tone="green"
          value="3,842"
        />
        <StatBlock
          change="6 need a reply"
          icon={MessageSquare}
          label="Comments"
          tone="yellow"
          value="286"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.7fr)]">
        <section className="bg-background rounded-lg border shadow-xs">
          <div className="flex items-start justify-between gap-3 border-b px-4 py-4 sm:items-center sm:px-5">
            <div>
              <h2 className="text-sm font-semibold">Audience this week</h2>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Daily views across all published posts
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold">2,914</span>
          </div>
          <div className="px-4 py-5 sm:px-5 sm:py-6">
            <div className="flex h-36 items-end gap-2 sm:h-44 sm:gap-5">
              {weeklyViews.map((height, index) => (
                <div
                  className="flex h-full flex-1 flex-col justify-end gap-2"
                  key={height}
                >
                  <div
                    className="bg-primary/20 hover:bg-primary/35 relative min-h-2 w-full rounded-sm transition-colors"
                    style={{ height: `${height}%` }}
                  >
                    <span className="bg-primary absolute inset-x-0 bottom-0 h-1 rounded-sm" />
                  </div>
                  <span className="text-muted-foreground text-center text-xs">
                    {["M", "T", "W", "T", "F", "S", "S"][index]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-background rounded-lg border shadow-xs">
          <div className="border-b px-5 py-4">
            <h2 className="text-sm font-semibold">Publishing queue</h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              The next items on your calendar
            </p>
          </div>
          <div className="divide-y">
            <div className="flex gap-3 px-5 py-4">
              <CalendarClock className="text-amber-600 mt-0.5 size-4" />
              <div>
                <p className="text-sm font-medium">Remote collaboration</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Scheduled Jul 24 at 09:00
                </p>
              </div>
            </div>
            <div className="flex gap-3 px-5 py-4">
              <PenLine className="text-muted-foreground mt-0.5 size-4" />
              <div>
                <p className="text-sm font-medium">
                  Architecture for everyday life
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Draft updated 2 hours ago
                </p>
              </div>
            </div>
          </div>
          <div className="border-t p-3">
            <Button asChild className="w-full" variant="ghost">
              <Link href="/posts/">
                View editorial calendar
                <ArrowUpRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>
      </div>

      <section className="bg-background overflow-hidden rounded-lg border shadow-xs">
        <div className="flex items-center justify-between border-b px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-sm font-semibold">Recent posts</h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Performance and status across the latest work
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/posts/">View all</Link>
          </Button>
        </div>
        <div className="divide-y sm:hidden">
          {blogPosts.slice(0, 4).map((post) => (
            <Link
              className="flex items-center gap-3 p-4"
              href={`/posts/${post.slug}/`}
              key={post.slug}
            >
              <span className="relative block size-14 shrink-0 overflow-hidden rounded-md">
                <Image
                  alt=""
                  className="object-cover"
                  fill
                  sizes="56px"
                  src={post.image}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-sm font-semibold leading-5">
                  {post.title}
                </span>
                <span className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                  <StatusBadge label={post.status} />
                  <span>{formatCompactNumber(post.views)} views</span>
                </span>
              </span>
              <ArrowUpRight className="text-muted-foreground size-4 shrink-0" />
            </Link>
          ))}
        </div>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-muted/60 text-muted-foreground text-xs uppercase">
              <tr>
                <th className="px-5 py-3 font-medium">Post</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Published</th>
                <th className="px-4 py-3 text-right font-medium">Views</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {blogPosts.slice(0, 4).map((post) => (
                <tr className="hover:bg-muted/30" key={post.slug}>
                  <td className="px-5 py-3">
                    <Link
                      className="flex items-center gap-3"
                      href={`/posts/${post.slug}/`}
                    >
                      <span className="relative block size-10 shrink-0 overflow-hidden rounded-md">
                        <Image
                          alt=""
                          className="object-cover"
                          fill
                          sizes="40px"
                          src={post.image}
                        />
                      </span>
                      <span>
                        <span className="block max-w-md truncate font-medium">
                          {post.title}
                        </span>
                        <span className="text-muted-foreground mt-0.5 block text-xs">
                          {post.category} / {post.author}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge label={post.status} />
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-xs">
                    {post.publishedAt}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatCompactNumber(post.views)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
