import { readFile } from "node:fs/promises";
import { join } from "node:path";
import Link from "next/link";
import { compileMDX } from "next-mdx-remote/rsc";
import { type Locale, localePath } from "~/lib/i18n";

export const ordinaryTomorrowMetadata = {
  title: "세계관 · 내일의 생활비",
  description:
    "2041년, 일곱 도시의 일상과 로맨스. 서로 다른 세대가 불확실한 내일을 살아가는 근미래 연작.",
};

export async function OrdinaryTomorrowGuide({ locale }: { locale: Locale }) {
  const source = await readFile(
    join(process.cwd(), "content/ordinary-tomorrow/world.md"),
    "utf8",
  );
  const { content } = await compileMDX({ source });
  const ui = {
    ko: { nav: "세계관 탐색", library: "소설 목록", first: "1화 읽기" },
    en: {
      nav: "World guide navigation",
      library: "Story library",
      first: "Read episode 1",
    },
    ja: {
      nav: "世界観ナビゲーション",
      library: "小説一覧",
      first: "第1話を読む",
    },
  }[locale];
  return (
    <div className="fiction-guide" lang={locale}>
      <nav aria-label={ui.nav}>
        <Link href={localePath(locale, "/fiction/")}>{ui.library}</Link>
        <Link href={localePath(locale, "/fiction/tomorrow-seoul-table/")}>
          {ui.first}
        </Link>
      </nav>
      <header>
        <p lang="ko">내일의 생활비 · 독립 세계관</p>
        <h1>조금 먼저 온 일상</h1>
        <p>
          작품 속 도시와 사람들의 일상을 소개합니다. 회차의 결말은 담지
          않았습니다.
        </p>
      </header>
      <article className="guide-prose" lang="ko">
        {content}
      </article>
    </div>
  );
}
