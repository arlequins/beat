import { ArrowLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { HomeIndex } from "~/components/blog/home-index";
import { BeatPostAssistantCard } from "~/features/beat-handoff/ui/beat-chat-entry";
import { getProject } from "~/lib/github";
import { type Locale, localePath } from "~/lib/i18n";
import { localizePost } from "~/lib/localized-content";
import { getPost, getPosts, type PostCategory } from "~/lib/posts";

const localized = {
  en: {
    categories: {
      weekly: "Weekly IT Brief",
      "deep-dive": "Tech Deep Dive",
      "studio-log": "Backstage · Making history",
    },
  },
  ja: {
    categories: {
      weekly: "週刊 IT ブリーフ",
      "deep-dive": "テック・ディープダイブ",
      "studio-log": "Backstage · 制作の記録",
    },
  },
} as const;

const projectCopy = {
  en: [
    [
      "Beat — Full-stack product template",
      "A full-stack monorepo that makes it possible to start fast without discarding operational quality later.",
    ],
    [
      "Agent-assisted product workflow",
      "An experiment in using an AI agent as a product-development partner with human review checkpoints.",
    ],
    [
      "Portfolio as a product",
      "A static portfolio, MDX writing system, GitHub metadata, and deployment flow designed as one developer experience.",
    ],
  ],
  ja: [
    [
      "Beat — フルスタック製品テンプレート",
      "素早く始めながら、後の運用品質を捨てないためのフルスタック・モノレポです。",
    ],
    [
      "エージェント支援の製品ワークフロー",
      "人のレビュー地点を残し、AI エージェントを製品開発の協働者として使う実験です。",
    ],
    [
      "プロダクトとしてのポートフォリオ",
      "静的ポートフォリオ、MDX、GitHub メタデータ、配布を一つの開発体験として整えました。",
    ],
  ],
} as const;

function labels(locale: Exclude<Locale, "ko">, category: PostCategory) {
  return localized[locale].categories[category];
}

export function LocalizedHome(props: { locale: Exclude<Locale, "ko"> }) {
  return <HomeIndex locale={props.locale} />;
}

export async function LocalizedPostsPage(props: {
  locale: Exclude<Locale, "ko">;
}) {
  const { locale } = props;
  const posts = await getPosts();
  const title = locale === "en" ? "IT notes" : "ITノート";
  return (
    <>
      <header className="page-heading">
        <div className="page-width">
          <h1>{title}</h1>
        </div>
      </header>
      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-5xl grid gap-16">
          {(["weekly", "deep-dive", "studio-log"] as PostCategory[]).map(
            (category) => (
              <section key={category}>
                <div className="border-b border-slate-950 pb-5">
                  <p className="brand-eyebrow text-[#075c66]">
                    {labels(locale, category)}
                  </p>
                </div>
                <div className="mt-px grid gap-px bg-slate-900/15 sm:grid-cols-2">
                  {posts
                    .filter((post) => post.category === category)
                    .map((post) => {
                      const translation = localizePost(locale, post);
                      return (
                        <article
                          className="note-card group flex flex-col bg-[#f5f0e6] p-6"
                          key={post.slug}
                        >
                          <p className="text-xs text-slate-500">
                            {post.publishedAt} · {post.readTime}
                          </p>
                          <h2 className="display-serif mt-5 text-3xl">
                            <Link
                              className="group-hover:text-[#b63f2d]"
                              href={localePath(locale, `/posts/${post.slug}/`)}
                            >
                              {translation?.title ?? post.title}
                            </Link>
                          </h2>
                          <p className="hidden sm:line-clamp-2 mt-4 leading-7 text-slate-600">
                            {translation?.excerpt ?? post.excerpt}
                          </p>
                        </article>
                      );
                    })}
                </div>
              </section>
            ),
          )}
        </div>
      </section>
    </>
  );
}

export async function LocalizedPostDetail(props: {
  locale: Exclude<Locale, "ko">;
  slug: string;
}) {
  const post = await getPost(props.slug);
  if (!post) return undefined;
  const translation = localizePost(props.locale, {
    ...post.frontmatter,
    slug: post.slug,
  });
  if (!translation) return undefined;
  return (
    <article>
      <header className="brand-hero px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <Link
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-[#79e6e0]"
            href={localePath(props.locale, "/posts/")}
          >
            <ArrowLeft aria-hidden="true" className="size-4" />{" "}
            {props.locale === "en" ? "All notes" : "すべてのノート"}
          </Link>
          <p className="brand-eyebrow mt-12 text-[#79e6e0]">
            {labels(props.locale, post.frontmatter.category)}
          </p>
          <h1
            className="display-serif mt-5 text-4xl leading-[1.04] sm:text-6xl"
            data-beat-context-title
          >
            {translation.title}
          </h1>
          <p
            className="mt-6 text-lg leading-8 text-slate-300 sm:text-xl"
            data-beat-context-excerpt
          >
            {translation.excerpt}
          </p>
          <p className="mt-8 border-t border-white/15 pt-4 text-sm text-slate-400">
            {post.frontmatter.publishedAt} · {post.frontmatter.readTime}
          </p>
        </div>
      </header>
      <div className="px-5 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-3xl">
          {post.frontmatter.reviewStatus === "unreviewed" ? (
            <p className="brand-eyebrow mb-8 text-slate-500">
              {props.locale === "en" ? "◇ Unreviewed" : "◇ 未確認"}
            </p>
          ) : null}
          <div className="prose-content text-[1.05rem] leading-8 text-slate-700">
            <p>{translation.intro}</p>
            {translation.sections.map((section) => (
              <section key={section.heading}>
                <h2>{section.heading}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </section>
            ))}
            {translation.sources ? (
              <section>
                <h2>{props.locale === "en" ? "Sources" : "参考資料"}</h2>
                <p>
                  {props.locale === "en"
                    ? "Official documentation checked on September 13, 2026. This is an explanatory special issue, not a report of announcements made today."
                    : "公式文書の確認日：2026年9月13日。本稿は技術解説であり、当日発表されたニュースの報告ではありません。"}
                </p>
                <ul>
                  {translation.sources.map((source) => (
                    <li key={source.url}>
                      <a href={source.url} target="_blank" rel="noreferrer">
                        {source.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {translation.links ? (
              <nav
                aria-label={
                  props.locale === "en" ? "Issue series" : "Issue series"
                }
              >
                <h2>
                  {props.locale === "en"
                    ? "Explore the series"
                    : "シリーズを読む"}
                </h2>
                <ul>
                  {translation.links.map((link) => (
                    <li key={link.slug}>
                      <Link
                        href={localePath(props.locale, `/posts/${link.slug}/`)}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
          </div>
          <BeatPostAssistantCard
            excerpt={translation.excerpt}
            locale={props.locale}
            title={translation.title}
          />
        </div>
      </div>
    </article>
  );
}

export async function LocalizedWorkDetail(props: {
  locale: Exclude<Locale, "ko">;
  slug: string;
}) {
  const project = await getProject(props.slug);
  if (!project) return undefined;
  const index = [
    "beat-template",
    "agent-assisted-product-workflow",
    "portfolio-as-a-product",
  ].indexOf(project.slug);
  const translation = projectCopy[props.locale][index] ?? [
    project.title,
    project.description,
  ];
  return (
    <article>
      <header className="brand-hero px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <Link
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-[#79e6e0]"
            href={`${localePath(props.locale)}#work`}
          >
            <ArrowLeft aria-hidden="true" className="size-4" />{" "}
            {props.locale === "en" ? "Work" : "作品"}
          </Link>
          <p className="brand-eyebrow mt-12 text-[#f6c85f]">
            Arlequin / {project.year}
          </p>
          <h1 className="display-serif mt-5 text-4xl sm:text-6xl">
            {translation[0]}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            {translation[1]}
          </p>
        </div>
      </header>
      <div className="px-5 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-4xl">
          <a
            className="inline-flex items-center gap-2 bg-[#111326] px-5 py-3 text-sm font-semibold text-white shadow-[0.3rem_0.3rem_0_#79e6e0]"
            href={project.repository}
            rel="noreferrer"
            target="_blank"
          >
            GitHub repository{" "}
            <ArrowUpRight aria-hidden="true" className="size-4" />
          </a>
          <div className="mt-14 grid gap-10 border-t border-slate-900/20 pt-10 sm:grid-cols-3">
            <h2 className="brand-eyebrow text-[#b63f2d]">
              {props.locale === "en" ? "Focus" : "焦点"}
            </h2>
            <p className="sm:col-span-2 leading-8 text-slate-700">
              {translation[1]}
            </p>
            <h2 className="brand-eyebrow text-[#075c66]">Stack</h2>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              {project.stack.map((item) => (
                <span
                  className="border border-slate-900/15 px-3 py-1 text-sm"
                  key={item}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
