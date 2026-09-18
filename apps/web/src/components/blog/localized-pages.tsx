import { ArrowLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { HomeIndex } from "~/components/blog/home-index";
import { LocalizedPostFeed } from "~/components/blog/localized-post-feed";
import { BeatPostAssistantCard } from "~/features/beat-handoff/ui/beat-chat-entry";
import { getProject } from "~/lib/github";
import { type Locale, localePath } from "~/lib/i18n";
import { localizePost } from "~/lib/localized-content";
import { getPost, getPosts, type PostCategory } from "~/lib/posts";
import {
  localizedProjectCopy,
  projectPrimaryLink,
} from "~/lib/project-content";

const postListCopy = {
  ko: {
    title: "IT 이슈",
    categories: {
      weekly: "주간 IT 브리핑",
      "deep-dive": "테크 딥다이브",
      "studio-log": "Backstage · 제작의 기록",
    },
  },
  en: {
    title: "IT notes",
    categories: {
      weekly: "Weekly IT Brief",
      "deep-dive": "Tech Deep Dive",
      "studio-log": "Backstage · Making history",
    },
  },
  ja: {
    title: "ITノート",
    categories: {
      weekly: "週刊 IT ブリーフ",
      "deep-dive": "テック・ディープダイブ",
      "studio-log": "Backstage · 制作の記録",
    },
  },
} as const satisfies Record<
  Locale,
  { categories: Record<PostCategory, string>; title: string }
>;

function labels(locale: Exclude<Locale, "ko">, category: PostCategory) {
  return postListCopy[locale].categories[category];
}

export function LocalizedHome(props: { locale: Exclude<Locale, "ko"> }) {
  return <HomeIndex locale={props.locale} />;
}

export async function LocalizedPostsPage(props: { locale: Locale }) {
  const { locale } = props;
  const posts = await getPosts();
  const text = postListCopy[locale];
  const categories = (
    ["weekly", "deep-dive", "studio-log"] as PostCategory[]
  ).map((value) => ({ label: text.categories[value], value }));
  const feedPosts = posts.map((post) => {
    const translation =
      locale === "ko" ? undefined : localizePost(locale, post);
    return {
      ...post,
      displayTitle: translation?.title ?? post.title,
      displayExcerpt: translation?.excerpt ?? post.excerpt,
    };
  });
  return (
    <>
      <header className="page-heading">
        <div className="page-width">
          <h1>{text.title}</h1>
        </div>
      </header>
      <LocalizedPostFeed
        categories={categories}
        locale={locale}
        posts={feedPosts}
      />
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
          <div className="mt-12 flex flex-wrap items-center gap-2">
            {post.frontmatter.reviewStatus === "unreviewed" ? (
              <span className="border border-[#f06449]/40 bg-[#f06449]/10 px-2.5 py-1 text-xs font-medium text-[#f7a08f]">
                {props.locale === "en" ? "◇ Unreviewed" : "◇ 未確認"}
              </span>
            ) : null}
            <p className="brand-eyebrow text-[#79e6e0]">
              {labels(props.locale, post.frontmatter.category)}
            </p>
          </div>
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
  const content = localizedProjectCopy(props.locale, project);
  const primaryLink = projectPrimaryLink(project, props.locale);
  const labels =
    props.locale === "en"
      ? { challenge: "Challenge", outcome: "Outcome", work: "What I built" }
      : { challenge: "課題", outcome: "成果", work: "取り組んだこと" };
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
            Arlequin / {project.year} · {content.role}
          </p>
          <h1 className="display-serif mt-5 text-4xl sm:text-6xl">
            {content.title}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            {content.description}
          </p>
        </div>
      </header>
      <div className="px-5 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-4xl">
          {primaryLink ? (
            <a
              className="inline-flex items-center gap-2 bg-[#111326] px-5 py-3 text-sm font-semibold text-white shadow-[0.3rem_0.3rem_0_#79e6e0]"
              href={primaryLink.href}
              rel="noreferrer"
              target="_blank"
            >
              {primaryLink.label}
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </a>
          ) : null}
          <div className="mt-14 grid gap-10 border-t border-slate-900/20 pt-10 sm:grid-cols-3">
            <h2 className="brand-eyebrow text-[#b63f2d]">{labels.challenge}</h2>
            <p className="sm:col-span-2 leading-8 text-slate-700">
              {content.challenge}
            </p>
            <h2 className="brand-eyebrow text-[#075c66]">{labels.work}</h2>
            <ul className="space-y-3 sm:col-span-2">
              {content.highlights.map((item) => (
                <li
                  className="border-l-2 border-[#f06449] pl-4 font-medium"
                  key={item}
                >
                  {item}
                </li>
              ))}
            </ul>
            <h2 className="brand-eyebrow text-[#b63f2d]">{labels.outcome}</h2>
            <p className="sm:col-span-2 leading-8 text-slate-700">
              {content.outcome}
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
