import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuideEntries, getGuideEntry } from "~/lib/fiction-guide";
import { type Locale, localePath } from "~/lib/i18n";

export async function FictionGuide({
  locale,
  slug,
}: {
  locale: Locale;
  slug?: string;
}) {
  const entries = await getGuideEntries();
  const entry = slug ? await getGuideEntry(slug) : undefined;
  if (slug && !entry) notFound();
  const next = entry
    ? entries.find((item) => item.order === entry.order + 1)
    : undefined;
  const previous = entry
    ? entries.find((item) => item.order === entry.order - 1)
    : undefined;
  const ui = {
    ko: {
      nav: "설정집 탐색",
      library: "소설 목록",
      index: "설정집 목차",
      source: "이 문서의 마크다운 원본",
      order: "문서 읽기 순서",
      next: "다음:",
    },
    en: {
      nav: "World guide navigation",
      library: "Story library",
      index: "Guide contents",
      source: "Markdown source for this guide",
      order: "Reading order",
      next: "Next:",
    },
    ja: {
      nav: "設定資料のナビゲーション",
      library: "小説一覧",
      index: "設定資料の目次",
      source: "この文書の Markdown 原文",
      order: "読む順序",
      next: "次へ:",
    },
  }[locale];
  return (
    <div className="fiction-guide" lang={locale}>
      <nav aria-label={ui.nav}>
        <Link href={localePath(locale, "/fiction/")}>{ui.library}</Link>
        {entry && (
          <Link href={localePath(locale, "/fiction/guide/")}>{ui.index}</Link>
        )}
      </nav>
      <header>
        <p lang="ko">여백의 사람들 · 설정집</p>
        <h1>{entry ? entry.title : "세계부터, 하나씩"}</h1>
        <p className="guide-status">
          {entry?.status ?? "설정집"} · {entry?.revision ?? "0.3 · 2026-09-22"}
        </p>
        <p>
          이 문서는 소설을 읽기 위한 세계의 안내입니다. 아직 이름이 없는 곳과
          여러 갈래로 전해지는 약속은 이야기 속에서 드러납니다.
        </p>
      </header>
      {entry ? (
        <>
          <article className="guide-prose" lang="ko">
            {entry.content}
          </article>
          <a
            href={`https://github.com/arlequins/beat/blob/main/apps/web/content/fiction-guide/${entry.slug}.md`}
          >
            {ui.source}
          </a>
          <nav className="guide-pagination" aria-label={ui.order}>
            {previous && (
              <Link
                href={localePath(locale, `/fiction/guide/${previous.slug}/`)}
              >
                ← {previous.title}
              </Link>
            )}
            {next && (
              <Link href={localePath(locale, `/fiction/guide/${next.slug}/`)}>
                {ui.next} {next.title} →
              </Link>
            )}
          </nav>
        </>
      ) : (
        <>
          <p>
            위에서부터 읽으면 강 하류의 생활과 소설 전체를 관통하는 길이
            이어집니다.
          </p>
          <ol className="guide-contents">
            {entries.map((item) => (
              <li key={item.slug}>
                <Link href={localePath(locale, `/fiction/guide/${item.slug}/`)}>
                  {item.title}
                </Link>
                <p>{item.summary}</p>
              </li>
            ))}
          </ol>
          <p>
            문서는 위 순서로 이어지며, 각 페이지의 라벨은 설정의 결을
            보여줍니다. 웹 본문은 마크다운 원본에서 생성됩니다.
          </p>
        </>
      )}
    </div>
  );
}
