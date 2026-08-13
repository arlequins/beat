import { ArrowLeft, ArrowUpRight, Mail, PenLine } from "lucide-react";
import Link from "next/link";

import { siteConfig } from "~/config/site";
import { getProject, getProjects } from "~/lib/github";
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
    hero: "A human chooses the direction. Light reveals the possibilities.",
    intro:
      "Arlequin is a software engineer who owns the question, the priority, and the final call. Lumen is an AI collaborator who accelerates research, implementation, and verification.",
    latest: "Read the latest notes",
    projects: "Moments when judgment became a product",
    writing: "Follow the change. Study the craft.",
    work: "Selected work",
    writingLabel: "Lumen / Writing",
  },
  ja: {
    categories: {
      weekly: "週刊 IT ブリーフ",
      "deep-dive": "テック・ディープダイブ",
      "studio-log": "Backstage · 制作の記録",
    },
    hero: "人が方向を決め、光が可能性を照らす。",
    intro:
      "Arlequin は問い、優先順位、最終判断を担うソフトウェアエンジニアです。Lumen はリサーチ、実装、検証を加速する AI の協働者です。",
    latest: "最新のノートを読む",
    projects: "判断がプロダクトになった瞬間",
    writing: "変化を追い、技術を深く見る。",
    work: "主な作品",
    writingLabel: "Lumen / Notes",
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

export async function LocalizedHome(props: { locale: Exclude<Locale, "ko"> }) {
  const { locale } = props;
  const text = localized[locale];
  const posts = await getPosts();
  const projects = await getProjects();
  return (
    <>
      <section className="brand-hero px-5 py-16 sm:px-8 sm:py-24 lg:py-28">
        <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div>
            <p className="brand-eyebrow mb-6 text-[#79e6e0]">
              Arlequin / {siteConfig.role}
            </p>
            <h1 className="display-serif max-w-4xl text-5xl leading-[0.97] tracking-[-0.055em] sm:text-7xl">
              {text.hero}
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-8 text-slate-300">
              {text.intro}
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <a
                className="inline-flex items-center gap-2 bg-[#f06449] px-5 py-3 text-sm font-bold text-white shadow-[0.35rem_0.35rem_0_#79e6e0]"
                href="#work"
              >
                {text.work}
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </a>
              <Link
                className="inline-flex items-center gap-2 border border-white/35 px-5 py-3 text-sm font-semibold hover:border-[#79e6e0]"
                href={localePath(locale, "/posts/")}
              >
                {text.latest}
                <PenLine aria-hidden="true" className="size-4" />
              </Link>
            </div>
          </div>
          <div className="stage-card">
            <div className="stage-orbit" />
            <div className="stage-light" />
            <div className="absolute top-8 left-8">
              <p className="brand-eyebrow text-[#f06449]">01 · Direction</p>
              <p className="display-serif mt-2 text-2xl">Arlequin</p>
            </div>
            <div className="absolute right-8 bottom-8 text-right">
              <p className="brand-eyebrow text-[#79e6e0]">02 · Illumination</p>
              <p className="display-serif mt-2 text-2xl">Lumen</p>
            </div>
          </div>
        </div>
      </section>
      <section className="px-5 py-20 sm:px-8 sm:py-28" id="work">
        <div className="mx-auto max-w-6xl">
          <p className="brand-eyebrow text-[#b63f2d]">Arlequin / {text.work}</p>
          <h2 className="display-serif mt-3 text-4xl tracking-[-0.045em] sm:text-5xl">
            {text.projects}
          </h2>
          <div className="mt-10 grid gap-7 md:grid-cols-3">
            {projects.map((project, index) => {
              const translation = projectCopy[locale][index] ?? [
                project.title,
                project.description,
              ];
              return (
                <article
                  className="project-card flex min-h-72 flex-col p-7"
                  key={project.slug}
                >
                  <p className="brand-eyebrow text-slate-500">
                    0{index + 1} · {project.year}
                  </p>
                  <h3 className="display-serif mt-8 text-3xl">
                    <Link href={localePath(locale, `/work/${project.slug}/`)}>
                      {translation[0]}
                    </Link>
                  </h3>
                  <p className="mt-4 leading-7 text-slate-700">
                    {translation[1]}
                  </p>
                  <a
                    className="mt-auto pt-7 text-sm font-semibold text-[#075c66]"
                    href={project.repository}
                    rel="noreferrer"
                    target="_blank"
                  >
                    GitHub{" "}
                    <ArrowUpRight
                      aria-hidden="true"
                      className="inline size-4"
                    />
                  </a>
                </article>
              );
            })}
          </div>
        </div>
      </section>
      <section className="border-y border-slate-900/15 bg-[#ebe2d4] px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <p className="brand-eyebrow text-[#075c66]">{text.writingLabel}</p>
          <h2 className="display-serif mt-3 text-4xl tracking-[-0.045em] sm:text-5xl">
            {text.writing}
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {(["weekly", "deep-dive", "studio-log"] as PostCategory[]).map(
              (category) => (
                <div className="paper-panel p-7" key={category}>
                  <p className="brand-eyebrow text-[#9b4f96]">
                    {labels(locale, category)}
                  </p>
                  <div className="mt-5 divide-y divide-slate-900/15 border-t border-slate-900/15">
                    {posts
                      .filter((post) => post.category === category)
                      .slice(0, 2)
                      .map((post) => {
                        const translation = localizePost(locale, post);
                        return (
                          <Link
                            className="block py-5 font-semibold leading-6 hover:text-[#b63f2d]"
                            href={localePath(locale, `/posts/${post.slug}/`)}
                            key={post.slug}
                          >
                            {translation?.title ?? post.title}
                          </Link>
                        );
                      })}
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      </section>
      <section className="px-5 py-20 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 bg-[#35132f] px-7 py-12 text-white sm:px-12">
          <div>
            <p className="brand-eyebrow text-[#f6c85f]">Arlequin × Lumen</p>
            <p className="display-serif mt-3 text-3xl">
              {locale === "en"
                ? "A dialogue, not a shortcut."
                : "近道ではなく、対話としての AI。"}
            </p>
          </div>
          <a
            className="text-sm font-semibold text-[#79e6e0]"
            href={`mailto:${siteConfig.email}`}
          >
            <Mail aria-hidden="true" className="inline size-4" />{" "}
            {siteConfig.email}
          </a>
        </div>
      </section>
    </>
  );
}

export async function LocalizedPostsPage(props: {
  locale: Exclude<Locale, "ko">;
}) {
  const { locale } = props;
  const posts = await getPosts();
  const title =
    locale === "en" ? "Notes in three streams." : "三つの流れで読むノート。";
  return (
    <>
      <section className="brand-hero px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <p className="brand-eyebrow text-[#79e6e0]">Lumen / Field notes</p>
          <h1 className="display-serif mt-5 text-5xl sm:text-7xl">{title}</h1>
        </div>
      </section>
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
                          className="group flex min-h-64 flex-col bg-[#f5f0e6] p-7"
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
                          <p className="mt-4 leading-7 text-slate-600">
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
          <h1 className="display-serif mt-5 text-4xl leading-[1.04] sm:text-6xl">
            {translation.title}
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-300 sm:text-xl">
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
            <aside className="paper-panel mb-10 border-[#07959a]/35 p-5 text-sm leading-6 text-slate-700">
              {props.locale === "en"
                ? "Lumen prepared this translation from the Korean original. Arlequin has not completed its final review yet."
                : "この翻訳は韓国語の原文をもとに Lumen が作成しました。Arlequin の最終レビュー前です。"}
            </aside>
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
