import { ArrowUpRight, BookOpen, NotebookPen, Utensils } from "lucide-react";
import Link from "next/link";
import { HomeScene } from "~/components/blog/home-scene";
import { projects } from "~/lib/blog-data";
import { getStories } from "~/lib/fiction";
import { copy, type Locale, localePath } from "~/lib/i18n";
import { localizePost } from "~/lib/localized-content";
import { getPosts } from "~/lib/posts";
import { localizedProjectCopy } from "~/lib/project-content";

const labels = {
  ko: {
    latest: "최근 글",
    meals: "식사 기록",
    stories: "여백의 사람들",
    episodes: "화",
    projects: "프로젝트",
    all: "전체",
    korean: "한국어",
    role: "소프트웨어 엔지니어 · AI 협업 제품 개발",
    featuredWork: "대표 프로젝트",
    viewProject: "사례 보기",
  },
  en: {
    latest: "Latest notes",
    meals: "Meals & places",
    stories: "People in the Margins",
    episodes: "episodes",
    projects: "Projects",
    all: "All",
    korean: "Korean",
    role: "Software engineer · AI-native product builder",
    featuredWork: "Featured work",
    viewProject: "View case study",
  },
  ja: {
    latest: "最近のノート",
    meals: "食事の記録",
    stories: "余白の人々",
    episodes: "話",
    projects: "プロジェクト",
    all: "すべて",
    korean: "韓国語",
    role: "ソフトウェアエンジニア · AI 協働プロダクト開発",
    featuredWork: "注力したプロジェクト",
    viewProject: "事例を見る",
  },
};

export async function HomeIndex({ locale }: { locale: Locale }) {
  const [posts, stories] = await Promise.all([getPosts(), getStories()]);
  const text = labels[locale];
  const featuredProject = projects[0]
    ? localizedProjectCopy(locale, projects[0])
    : undefined;
  return (
    <HomeScene>
      <div className="home-index">
        <h1 className="index-signature">
          Arlequin <span>×</span> Lumen
        </h1>
        <p className="index-role">{text.role}</p>
        <nav
          className="index-destinations"
          aria-label={
            locale === "ko"
              ? "콘텐츠"
              : locale === "ja"
                ? "コンテンツ"
                : "Content"
          }
        >
          <Link
            href={localePath(locale, "/posts/")}
            className="index-route index-route-writing"
          >
            <div className="index-route-top">
              <NotebookPen size={22} aria-hidden="true" />
              <ArrowUpRight size={18} aria-hidden="true" />
            </div>
            <span>{copy[locale].writing}</span>
            <span className="index-route-detail">{posts.length}</span>
          </Link>
          <Link
            href={localePath(locale, "/gourmet/")}
            className="index-route index-route-gourmet"
          >
            <div className="index-route-top">
              <Utensils size={22} aria-hidden="true" />
              <ArrowUpRight size={18} aria-hidden="true" />
            </div>
            <span>Gourmet</span>
            <span className="index-route-detail">{text.meals}</span>
          </Link>
          <Link
            href={localePath(locale, "/fiction/")}
            className="index-route index-route-fiction"
          >
            <div className="index-route-top">
              <BookOpen size={22} aria-hidden="true" />
              <ArrowUpRight size={18} aria-hidden="true" />
            </div>
            <span>{copy[locale].fiction}</span>
            <span className="index-route-detail">
              {stories.length} {text.episodes}
            </span>
          </Link>
        </nav>
        {projects[0] && featuredProject ? (
          <section
            aria-labelledby="index-featured-title"
            className="index-featured"
          >
            <p className="brand-eyebrow" id="index-featured-title">
              {text.featuredWork}
            </p>
            <div className="index-featured-copy">
              <h2>
                <Link href={localePath(locale, `/work/${projects[0].slug}/`)}>
                  {featuredProject.title}
                </Link>
              </h2>
              <p>{featuredProject.description}</p>
              <Link
                className="index-featured-action"
                href={localePath(locale, `/work/${projects[0].slug}/`)}
              >
                {text.viewProject}
                <ArrowUpRight aria-hidden="true" size={16} />
              </Link>
            </div>
          </section>
        ) : null}
        <section className="index-latest" aria-labelledby="index-latest">
          <div className="index-section-heading">
            <h2 id="index-latest">{text.latest}</h2>
            <Link href={localePath(locale, "/posts/")}>{text.all}</Link>
          </div>
          <ul className="index-notes">
            {posts.slice(0, 3).map((post) => (
              <li key={post.slug}>
                <Link href={localePath(locale, `/posts/${post.slug}/`)}>
                  <time dateTime={post.publishedAt}>
                    {post.publishedAt.slice(5).replace("-", ".")}
                  </time>
                  <span
                    title={
                      locale === "ko"
                        ? post.title
                        : (localizePost(locale, post)?.title ?? post.title)
                    }
                  >
                    {locale === "ko"
                      ? post.title
                      : (localizePost(locale, post)?.title ?? post.title)}
                  </span>
                  {post.reviewStatus === "unreviewed" ? (
                    <small>
                      {locale === "ko"
                        ? "미확정본"
                        : locale === "ja"
                          ? "未確認"
                          : "Unreviewed"}
                    </small>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <div className="index-reading">
          {stories[0] ? (
            <Link
              href={localePath(locale, "/fiction/")}
              className="index-fiction"
              aria-labelledby="index-fiction-title"
            >
              <div className="index-section-heading">
                <h2 id="index-fiction-title">{copy[locale].fiction}</h2>
                <span>{text.korean}</span>
              </div>
              <div className="index-story-link">
                <span className="index-story-series">{text.stories}</span>
                <span>
                  {stories.length} {text.episodes}{" "}
                  <ArrowUpRight size={18} aria-hidden="true" />
                </span>
              </div>
            </Link>
          ) : null}
        </div>
        <details className="index-projects" id="work">
          <summary>
            {text.projects}
            <span>{projects.length}</span>
          </summary>
          <ul>
            {projects.map((project) => (
              <li key={project.slug}>
                <Link href={localePath(locale, `/work/${project.slug}/`)}>
                  {localizedProjectCopy(locale, project).title}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </HomeScene>
  );
}
