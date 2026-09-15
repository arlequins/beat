import { ArrowUpRight, BookOpen, NotebookPen, Utensils } from "lucide-react";
import Link from "next/link";
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
  const intro = {
    ko: "읽고, 먹고, 만듭니다.",
    en: "Notes, meals, and stories.",
    ja: "読む、食べる、つくる。",
  }[locale];
  return (
    <HomeScene>
      <div className="home-index">
        <header className="home-intro">
          <p className="home-kicker">ARLEQUIN / 2026</p>
          <h1 className="index-signature">
            Arlequin <span>×</span> Lumen
          </h1>
          <p className="home-standfirst">{intro}</p>
        </header>
        <section className="index-latest" aria-labelledby="index-latest">
          <div className="index-section-heading">
            <h2 id="index-latest">{text.latest}</h2>
            <Link href={localePath(locale, "/posts/")}>
              <span>{text.all}</span>
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
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
        <section className="index-routes" aria-labelledby="index-routes">
          <div className="index-section-heading">
            <h2 id="index-routes">
              {locale === "ko"
                ? "둘러보기"
                : locale === "ja"
                  ? "見る"
                  : "Explore"}
            </h2>
            <span className="index-section-note">03</span>
          </div>
          <nav
            className="index-destinations"
            aria-label={locale === "ko" ? "콘텐츠" : "Content"}
          >
            <Link
              href={localePath(locale, "/posts/")}
              className="index-route index-route-writing"
            >
              <span className="index-route-number">01</span>
              <NotebookPen size={18} aria-hidden="true" />
              <span className="index-route-name">{copy[locale].writing}</span>
              <span className="index-route-detail">{posts.length}</span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
            <Link
              href={localePath(locale, "/gourmet/")}
              className="index-route index-route-gourmet"
            >
              <span className="index-route-number">02</span>
              <Utensils size={18} aria-hidden="true" />
              <span className="index-route-name">Gourmet</span>
              <span className="index-route-detail">{text.meals}</span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
            <Link
              href={localePath(locale, "/fiction/")}
              className="index-route index-route-fiction"
            >
              <span className="index-route-number">03</span>
              <BookOpen size={18} aria-hidden="true" />
              <span className="index-route-name">{copy[locale].fiction}</span>
              <span className="index-route-detail">
                {stories.length} {text.episodes}
              </span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </nav>
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
