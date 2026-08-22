import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LocalizedPostDetail } from "~/components/blog/localized-pages";
import { getPost, getPosts, postCategoryMeta } from "~/lib/posts";
import { localizedAlternates } from "~/lib/seo";

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getPosts()).map((post) => ({ slug: post.slug }));
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const post = await getPost(slug);
  return {
    alternates: localizedAlternates("en", `/posts/${slug}/`),
    description: post?.frontmatter.excerpt,
    title: post?.frontmatter.title ?? "Writing",
  };
}

export async function KoreanPostDetailPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const post = await getPost((await props.params).slug);
  if (!post) notFound();

  return (
    <article>
      <header className="brand-hero px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <Link
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-[#79e6e0]"
            href="/posts/"
          >
            <ArrowLeft aria-hidden="true" className="size-4" /> 모든 글
          </Link>
          <div className="mt-12 flex flex-wrap gap-2 text-xs font-medium text-slate-400">
            <span className="border border-[#79e6e0]/40 bg-[#79e6e0]/10 px-2.5 py-1 text-[#79e6e0]">
              {postCategoryMeta[post.frontmatter.category].label}
            </span>
            {post.frontmatter.tags.map((tag) => (
              <span className="border border-white/15 px-2.5 py-1" key={tag}>
                {tag}
              </span>
            ))}
          </div>
          <h1
            className="display-serif mt-6 text-4xl leading-[1.04] tracking-[-0.055em] text-balance sm:text-6xl"
            data-beat-context-title
          >
            {post.frontmatter.title}
          </h1>
          <p
            className="mt-6 max-w-3xl text-lg leading-8 text-slate-300 sm:text-xl"
            data-beat-context-excerpt
          >
            {post.frontmatter.excerpt}
          </p>
          <div className="mt-8 border-t border-white/15 pt-4 text-sm text-slate-400">
            {post.frontmatter.publishedAt} · {post.frontmatter.readTime}
          </div>
        </div>
      </header>
      <div className="px-5 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-3xl">
          {post.frontmatter.reviewStatus === "unreviewed" ? (
            <aside className="paper-panel relative mb-12 overflow-hidden border-[#f06449]/40 p-6 text-sm leading-6 text-slate-700">
              <div className="absolute top-0 left-0 h-full w-1.5 bg-[#f06449]" />
              <p className="brand-eyebrow text-[#a33a28]">
                ◇ 미확정본 · 공개 검토 중
              </p>
              <p className="mt-3">
                Lumen이 리서치와 초안을 도왔으며, 아직 Arlequin의 최종 검토를
                거치지 않았습니다. 공개된 글이지만 내용과 판단은 변경될 수
                있습니다.
              </p>
            </aside>
          ) : null}
          <div className="prose-content text-[1.05rem] leading-8 text-slate-700">
            {post.content}
          </div>
          <div className="lumen-rule mt-16" />
          <p className="mt-6 text-sm leading-6 text-slate-500">
            Written in dialogue: Lumen assists with research and drafting.
            Arlequin owns the final judgment.
          </p>
        </div>
      </div>
    </article>
  );
}

export default async function PostDetailPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const page = await LocalizedPostDetail({
    locale: "en",
    slug: (await props.params).slug,
  });
  if (!page) notFound();
  return page;
}
