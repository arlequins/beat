import Link from "next/link";
import { HomeObject } from "~/components/blog/home-object";
import { HomeScene } from "~/components/blog/home-scene";
import { projects } from "~/lib/blog-data";
import { getStories } from "~/lib/fiction";
import { copy, type Locale, localePath } from "~/lib/i18n";
import { localizePost } from "~/lib/localized-content";
import { getPosts } from "~/lib/posts";

const labels = {
  ko: {
    latest: "최근 글",
    meals: "식사 기록",
    stories: "여백의 사람들",
    episodes: "화",
    projects: "프로젝트",
    all: "전체",
    korean: "한국어",
  },
  en: {
    latest: "Latest notes",
    meals: "Meals & places",
    stories: "People in the Margins",
    episodes: "episodes",
    projects: "Projects",
    all: "All",
    korean: "Korean",
  },
  ja: {
    latest: "最近のノート",
    meals: "食事の記録",
    stories: "余白の人々",
    episodes: "話",
    projects: "プロジェクト",
    all: "すべて",
    korean: "韓国語",
  },
};

export async function HomeIndex({ locale }: { locale: Locale }) {
  const [posts, stories] = await Promise.all([getPosts(), getStories()]);
  const text = labels[locale];
  return (
    <HomeScene>
      <div className="home-index">
        <h1 className="index-signature">
          Arlequin <span>×</span> Lumen
        </h1>
        <HomeObject locale={locale} />
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
            <section
              className="index-fiction"
              aria-labelledby="index-fiction-title"
            >
              <div className="index-section-heading">
                <h2 id="index-fiction-title">{copy[locale].fiction}</h2>
                <span>{text.korean}</span>
              </div>
              <Link
                className="index-story-link"
                href={localePath(locale, `/fiction/${stories[0].slug}/`)}
              >
                <span className="index-story-series">{text.stories}</span>
                <span>{stories[0].title}</span>
              </Link>
            </section>
          ) : null}
        </div>
        <nav
          className="index-destinations"
          aria-label={locale === "ko" ? "콘텐츠" : "Content"}
        >
          <Link
            href={localePath(locale, "/posts/")}
            className="index-route index-route-writing"
          >
            <span>{copy[locale].writing}</span>
            <span className="index-route-detail">{posts.length}</span>
          </Link>
          <Link
            href={localePath(locale, "/gourmet/")}
            className="index-route index-route-gourmet"
          >
            <span>Gourmet</span>
            <span className="index-route-detail">{text.meals}</span>
          </Link>
          <Link
            href={localePath(locale, "/fiction/")}
            className="index-route index-route-fiction"
          >
            <span>{copy[locale].fiction}</span>
            <span className="index-route-detail">
              {stories.length} {text.episodes}
            </span>
          </Link>
        </nav>
        <details className="index-projects" id="work">
          <summary>
            {text.projects}
            <span>{projects.length}</span>
          </summary>
          <ul>
            {projects.map((project) => (
              <li key={project.slug}>
                <Link href={localePath(locale, `/work/${project.slug}/`)}>
                  {project.title}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </HomeScene>
  );
}
