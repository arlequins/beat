import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { getPosts, type PostCategory, postCategoryMeta } from "~/lib/posts";

export const metadata: Metadata = {
  title: "Writing · Lumen",
  description: "제품 개발과 기술에 대한 기록",
};

export default async function PostsPage() {
  const posts = await getPosts();
  const categories: PostCategory[] = ["weekly", "deep-dive", "studio-log"];
  return (
    <>
      <section className="brand-hero px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <p className="brand-eyebrow text-[#79e6e0]">Lumen / Field notes</p>
          <h1 className="display-serif mt-5 max-w-4xl text-5xl leading-[1.02] tracking-[-0.055em] sm:text-7xl">
            변화의 흐름과
            <br />
            기술의 깊이를 함께 봅니다.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300">
            매주 지나가는 신호는 넓게 비추고, 오래 남길 기술은 한곳에 빛을 모아
            살펴봅니다. Lumen이 초안을 돕고 Arlequin이 판단합니다.
          </p>
        </div>
      </section>
      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-16">
            {categories.map((category) => {
              const categoryPosts = posts.filter(
                (post) => post.category === category,
              );
              const meta = postCategoryMeta[category];
              return (
                <section key={category}>
                  <div className="flex flex-wrap items-end justify-between gap-5 border-b border-slate-950 pb-6">
                    <div>
                      <p
                        className={`brand-eyebrow ${category === "weekly" ? "text-[#b63f2d]" : "text-[#075c66]"}`}
                      >
                        {meta.shortLabel}
                      </p>
                      <h2 className="display-serif mt-2 text-4xl tracking-[-0.045em]">
                        {meta.label}
                      </h2>
                    </div>
                    <p className="max-w-sm text-sm leading-6 text-slate-500">
                      {meta.description}
                    </p>
                  </div>
                  <div className="grid gap-px bg-slate-900/15 sm:grid-cols-2">
                    {categoryPosts.map((post) => (
                      <article
                        className="group flex min-h-72 flex-col bg-[#f5f0e6] p-7 sm:p-8"
                        key={post.slug}
                      >
                        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                          {post.reviewStatus === "unreviewed" ? (
                            <span className="border border-[#f06449]/40 bg-[#f06449]/10 px-2.5 py-1 text-[#9f3524]">
                              ◇ 미확정본
                            </span>
                          ) : null}
                          {post.tags.map((tag) => (
                            <span
                              className="border border-slate-900/10 px-2.5 py-1"
                              key={tag}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        <h3 className="display-serif mt-6 text-2xl leading-tight tracking-[-0.035em] sm:text-3xl">
                          <Link
                            className="group-hover:text-[#b63f2d]"
                            href={`/posts/${post.slug}/`}
                          >
                            {post.title}
                          </Link>
                        </h3>
                        <p className="mt-4 leading-7 text-slate-600">
                          {post.excerpt}
                        </p>
                        <div className="mt-auto flex items-center justify-between pt-7 text-sm text-slate-500">
                          <span>
                            {post.publishedAt} · {post.readTime}
                          </span>
                          <Link
                            aria-label={`${post.title} 읽기`}
                            className="border border-slate-900/20 p-2 text-slate-950 group-hover:bg-[#111326] group-hover:text-white"
                            href={`/posts/${post.slug}/`}
                          >
                            <ArrowUpRight
                              aria-hidden="true"
                              className="size-4"
                            />
                          </Link>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
