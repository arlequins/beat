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
  return (
    <div className="fiction-guide" lang="ko">
      <nav aria-label="설정집 탐색">
        <Link href={localePath(locale, "/fiction/")}>소설 목록</Link>
        {entry && (
          <Link href={localePath(locale, "/fiction/guide/")}>설정집 목차</Link>
        )}
      </nav>
      <header>
        <p>여백의 사람들 · 설정집</p>
        <h1>{entry ? entry.title : "세계부터, 하나씩"}</h1>
        <p className="guide-status">
          {entry?.status ?? "설정집"} · {entry?.revision ?? "0.2 · 2026-09-14"}
        </p>
        <p>
          이 문서는 소설을 읽기 위한 세계의 안내입니다. 아직 이름이 없는 곳과
          여러 갈래로 전해지는 약속은 이야기 속에서 드러납니다.
        </p>
      </header>
      {entry ? (
        <>
          <article className="guide-prose">{entry.content}</article>
          <a
            href={`https://github.com/arlequins/beat/blob/main/apps/web/content/fiction-guide/${entry.slug}.md`}
          >
            이 문서의 마크다운 원본
          </a>
          <nav className="guide-pagination" aria-label="문서 읽기 순서">
            {previous && (
              <Link
                href={localePath(locale, `/fiction/guide/${previous.slug}/`)}
              >
                ← {previous.title}
              </Link>
            )}
            {next && (
              <Link href={localePath(locale, `/fiction/guide/${next.slug}/`)}>
                다음: {next.title} →
              </Link>
            )}
          </nav>
        </>
      ) : (
        <>
          <p>
            위에서부터 읽으면 강 하류의 생활과 소설 스무 편을 관통하는 길이
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
