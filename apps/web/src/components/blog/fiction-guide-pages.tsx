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
          {entry?.status ?? "검토 전 초안"} ·{" "}
          {entry?.revision ?? "0.1 · 2026-09-14"}
        </p>
        <p>
          승인된 창작 설정은 아직 없습니다. 기존 다섯 편도 검토할 초안이며, 아래
          제안은 원고에 적용하지 않았습니다.
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
            위에서부터 읽고 각 문서 끝의 검토 쟁점을 확인해 주세요. 한국어
            초안이며, 기존 다섯 편의 내용이 포함됩니다. 의견은 문서명과 항목을
            지정해 이 대화에 남기면 됩니다.
          </p>
          <ol className="guide-contents">
            {entries.map((item) => (
              <li key={item.slug}>
                <Link href={localePath(locale, `/fiction/guide/${item.slug}/`)}>
                  {item.title}
                </Link>
                <p>{item.summary}</p>
                <small>{item.status}</small>
              </li>
            ))}
          </ol>
          <p>
            읽기 순서와 상태는 이 목차를 따릅니다. 승인 범위와 변경 기록은
            마지막 문서에서 관리합니다. 웹 본문은 마크다운 원본에서 생성됩니다.
          </p>
        </>
      )}
    </div>
  );
}
