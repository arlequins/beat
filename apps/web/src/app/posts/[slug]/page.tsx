import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LocalizedPostDetail } from "~/components/blog/localized-pages";
import { BeatPostAssistantCard } from "~/features/beat-handoff/ui/beat-chat-entry";
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
            href="/ko/posts/"
          >
            <ArrowLeft aria-hidden="true" className="size-4" /> 모든 글
          </Link>
          <div className="mt-12 flex flex-wrap gap-2 text-xs font-medium text-slate-400">
            {post.frontmatter.reviewStatus === "unreviewed" ? (
              <span className="border border-[#f06449]/40 bg-[#f06449]/10 px-2.5 py-1 text-[#f7a08f]">
                ◇ 미확정본
              </span>
            ) : null}
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
          <div className="prose-content text-[1.05rem] leading-8 text-slate-700">
            {post.content}
          </div>
          <div className="lumen-rule mt-16" />
          <p className="mt-6 text-sm leading-6 text-slate-500">
            Lumen이 자료를 모으고 그 사이의 연결을 찾습니다. Arlequin과 함께
            묻고 다듬어 한 편의 글로 엮습니다.
          </p>
          <BeatPostAssistantCard
            excerpt={post.frontmatter.excerpt}
            locale="ko"
            title={post.frontmatter.title}
          />
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
