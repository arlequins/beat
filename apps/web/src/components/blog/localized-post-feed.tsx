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
    result: "件",
    search: "ノートを検索",
    searchPlaceholder: "タイトル、トピック、タグで検索",
    unreviewed: "未確認",
  },
};

export function LocalizedPostFeed(props: {
  categories: FeedCategory[];
  locale: Locale;
  posts: FeedPost[];
}) {
  const text = labels[props.locale];
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PostCategory | "all">("all");
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
              className="min-h-12 w-full border border-slate-900/20 bg-[var(--paper)] py-3 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#075c66]"
              onChange={(event) => setQuery(event.target.value)}
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
            className="min-h-10 border border-slate-900/20 px-3 text-sm aria-pressed:bg-[#111326] aria-pressed:text-white"
            onClick={() => setCategory("all")}
            type="button"
          >
            {text.all}
          </button>
          {props.categories.map((item) => (
            <button
              aria-pressed={category === item.value}
              className="min-h-10 border border-slate-900/20 px-3 text-sm aria-pressed:bg-[#111326] aria-pressed:text-white"
              key={item.value}
              onClick={() => setCategory(item.value)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        {props.posts.some((post) => post.reviewStatus === "unreviewed") ? (
          <p className="mt-5 border-l-2 border-[#f06449] bg-[#f06449]/5 px-4 py-3 text-sm leading-6 text-slate-700">
            {text.notice}
          </p>
        ) : null}

        {filteredPosts.length === 0 ? (
          <div className="mt-8 border border-dashed border-slate-900/20 p-8 text-center">
            <p className="text-slate-700">{text.empty}</p>
            <button
              className="mt-3 min-h-10 px-3 text-sm font-semibold underline underline-offset-4"
              onClick={() => {
                setCategory("all");
                setQuery("");
              }}
              type="button"
            >
              {text.clear}
            </button>
          </div>
        ) : (
          <div className="mt-10 grid gap-12">
            {props.categories.map((item) => {
              const categoryPosts = filteredPosts.filter(
                (post) => post.category === item.value,
              );
              if (categoryPosts.length === 0) return null;
              return (
                <section
                  aria-labelledby={`notes-${item.value}`}
                  key={item.value}
                >
                  <div className="mb-4 border-b border-slate-950 pb-4">
                    <h2
                      className="brand-eyebrow text-[#075c66]"
                      id={`notes-${item.value}`}
                    >
                      {item.label}
                    </h2>
                  </div>
                  <div className="grid gap-px bg-slate-900/15 sm:grid-cols-2">
                    {categoryPosts.map((post) => (
                      <article
                        className="note-card group flex flex-col bg-[#f5f0e6] p-6"
                        key={post.slug}
                      >
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          {post.reviewStatus === "unreviewed" ? (
                            <span className="border border-[#f06449]/40 bg-[#f06449]/10 px-2.5 py-1 text-[#9f3524]">
                              ◇ {text.unreviewed}
                            </span>
                          ) : null}
                          <span>
                            {post.publishedAt} · {post.readTime}
                          </span>
                        </div>
                        <h3 className="display-serif mt-5 text-2xl leading-tight tracking-[-0.035em] sm:text-3xl">
                          <Link
                            className="group-hover:text-[#b63f2d]"
                            href={localePath(
                              props.locale,
                              `/posts/${post.slug}/`,
                            )}
                          >
                            {post.displayTitle}
                          </Link>
                        </h3>
                        <p className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                          {post.tags.slice(0, 3).map((tag) => (
                            <span
                              className="border border-slate-900/10 px-2 py-1"
                              key={tag}
                            >
                              {tag}
                            </span>
                          ))}
                        </p>
                        <p className="hidden sm:line-clamp-2 mt-3 leading-7 text-slate-600">
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
      </div>
    </section>
  );
}
