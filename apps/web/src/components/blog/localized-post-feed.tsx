"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { type Locale, localePath } from "~/lib/i18n";
import type { PostCategory, PostSummary } from "~/lib/posts";

type FeedPost = PostSummary & {
  displayExcerpt: string;
  displayTitle: string;
};

type FeedCategory = { label: string; value: PostCategory };

const labels: Record<
  Locale,
  {
    all: string;
    clear: string;
    empty: string;
    filter: string;
    notice: string;
    next: string;
    page: string;
    previous: string;
    result: string;
    search: string;
    searchPlaceholder: string;
    unreviewed: string;
  }
> = {
  ko: {
    all: "전체 주제",
    clear: "검색 지우기",
    empty: "조건에 맞는 글이 없습니다.",
    filter: "주제별 보기",
    notice:
      "최근 글 일부는 미확정본입니다. 최종 편집 검토 전의 내용으로 읽어 주세요.",
    next: "다음",
    page: "페이지",
    previous: "이전",
    result: "개 글",
    search: "글 검색",
    searchPlaceholder: "제목, 주제, 태그 검색",
    unreviewed: "미확정본",
  },
  en: {
    all: "All topics",
    clear: "Clear search",
    empty: "No notes match your search.",
    filter: "Browse by topic",
    notice:
      "Some recent notes are marked Unreviewed and have not had a final editorial review.",
    next: "Next",
    page: "Page",
    previous: "Previous",
    result: "notes",
    search: "Search notes",
    searchPlaceholder: "Search titles, topics, or tags",
    unreviewed: "Unreviewed",
  },
  ja: {
    all: "すべてのトピック",
    clear: "検索をクリア",
    empty: "条件に合うノートはありません。",
    filter: "トピックから探す",
    notice:
      "一部の新しいノートは未確認です。最終的な編集レビュー前の内容としてお読みください。",
    next: "次へ",
    page: "ページ",
    previous: "前へ",
    result: "件",
    search: "ノートを検索",
    searchPlaceholder: "タイトル、トピック、タグで検索",
    unreviewed: "未確認",
  },
};
const pageSize = 20;

export function LocalizedPostFeed(props: {
  categories: FeedCategory[];
  locale: Locale;
  posts: FeedPost[];
}) {
  const text = labels[props.locale];
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PostCategory | "all">("all");
  const [page, setPage] = useState(0);
  const filteredPosts = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(props.locale);
    return props.posts.filter((post) => {
      if (category !== "all" && post.category !== category) return false;
      if (!needle) return true;
      return [
        post.displayTitle,
        post.displayExcerpt,
        post.title,
        post.excerpt,
        ...post.tags,
      ]
        .join(" ")
        .toLocaleLowerCase(props.locale)
        .includes(needle);
    });
  }, [category, props.locale, props.posts, query]);
  const pageCount = Math.ceil(filteredPosts.length / pageSize);
  const visiblePosts = filteredPosts.slice(
    page * pageSize,
    (page + 1) * pageSize,
  );

  return (
    <section className="px-5 py-10 sm:px-8 sm:py-14">
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <label className="relative block">
            <span className="sr-only">{text.search}</span>
            <Search
              aria-hidden="true"
              className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500"
            />
            <input
              className="min-h-12 w-full border border-[var(--line)] bg-[var(--paper)] py-3 pr-4 pl-11 text-sm text-[var(--ink)] placeholder:text-[var(--muted-foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-foreground)]"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
              placeholder={text.searchPlaceholder}
              type="search"
              value={query}
            />
          </label>
          <p
            aria-live="polite"
            className="text-sm text-[var(--muted-foreground)] sm:text-right"
          >
            {filteredPosts.length} {text.result}
          </p>
        </div>

        <div
          aria-label={text.filter}
          className="mt-4 flex flex-wrap gap-2"
          role="group"
        >
          <button
            aria-pressed={category === "all"}
            className="min-h-10 rounded-full border border-[var(--line)] px-4 text-sm text-[var(--ink)] aria-pressed:border-[var(--ink)] aria-pressed:bg-[var(--ink)] aria-pressed:text-[var(--paper)]"
            onClick={() => {
              setCategory("all");
              setPage(0);
            }}
            type="button"
          >
            {text.all}
          </button>
          {props.categories.map((item) => (
            <button
              aria-pressed={category === item.value}
              className="min-h-10 rounded-full border border-[var(--line)] px-4 text-sm text-[var(--ink)] aria-pressed:border-[var(--ink)] aria-pressed:bg-[var(--ink)] aria-pressed:text-[var(--paper)]"
              key={item.value}
              onClick={() => {
                setCategory(item.value);
                setPage(0);
              }}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        {props.posts.some((post) => post.reviewStatus === "unreviewed") ? (
          <p className="mt-5 border-l-2 border-[var(--coral)] bg-[var(--coral)]/5 px-4 py-3 text-sm leading-6 text-[var(--ink)]">
            {text.notice}
          </p>
        ) : null}

        {filteredPosts.length === 0 ? (
          <div className="mt-8 border border-dashed border-[var(--line)] p-8 text-center">
            <p className="text-[var(--ink)]">{text.empty}</p>
            <button
              className="mt-3 min-h-10 px-3 text-sm font-semibold text-[var(--accent-foreground)] underline underline-offset-4"
              onClick={() => {
                setCategory("all");
                setQuery("");
                setPage(0);
              }}
              type="button"
            >
              {text.clear}
            </button>
          </div>
        ) : (
          <div className="mt-10 grid gap-12">
            {props.categories.map((item) => {
              const categoryPosts = visiblePosts.filter(
                (post) => post.category === item.value,
              );
              if (categoryPosts.length === 0) return null;
              return (
                <section
                  aria-labelledby={`notes-${item.value}`}
                  key={item.value}
                >
                  <div className="mb-4 border-b border-[var(--line)] pb-4">
                    <h2
                      className="brand-eyebrow text-[var(--accent-foreground)]"
                      id={`notes-${item.value}`}
                    >
                      {item.label}
                    </h2>
                  </div>
                  <div className="grid gap-px bg-slate-900/15 sm:grid-cols-2">
                    {categoryPosts.map((post) => (
                      <article
                        className="note-card group flex flex-col bg-[var(--paper)] p-6"
                        key={post.slug}
                      >
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
                          {post.reviewStatus === "unreviewed" ? (
                            <span className="border border-[var(--coral)]/40 bg-[var(--coral)]/10 px-2.5 py-1 text-[#9f3524]">
                              ◇ {text.unreviewed}
                            </span>
                          ) : null}
                          <span>
                            {post.publishedAt} · {post.readTime}
                          </span>
                        </div>
                        <h3 className="display-serif mt-5 text-2xl leading-tight tracking-[-0.035em] sm:text-3xl">
                          <Link
                            className="text-[var(--ink)] group-hover:text-[var(--accent-foreground)]"
                            href={localePath(
                              props.locale,
                              `/posts/${post.slug}/`,
                            )}
                          >
                            {post.displayTitle}
                          </Link>
                        </h3>
                        <p className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--muted-foreground)]">
                          {post.tags.slice(0, 3).map((tag) => (
                            <span
                              className="border border-[var(--line)] px-2 py-1"
                              key={tag}
                            >
                              {tag}
                            </span>
                          ))}
                        </p>
                        <p className="hidden sm:line-clamp-2 mt-3 leading-7 text-[var(--muted-foreground)]">
                          {post.displayExcerpt}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
        {pageCount > 1 ? (
          <nav aria-label={text.page} className="site-pagination">
            <button
              disabled={page === 0}
              onClick={() => setPage((value) => value - 1)}
              type="button"
            >
              {text.previous}
            </button>
            <span aria-live="polite">
              {text.page} {page + 1} / {pageCount}
            </span>
            <button
              disabled={page >= pageCount - 1}
              onClick={() => setPage((value) => value + 1)}
              type="button"
            >
              {text.next}
            </button>
          </nav>
        ) : null}
      </div>
    </section>
  );
}
