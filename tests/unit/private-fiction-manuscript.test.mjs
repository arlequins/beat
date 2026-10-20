import assert from "node:assert/strict";
import test from "node:test";
import { parseManuscript } from "../../apps/web/src/components/admin/private-fiction-manuscript.ts";

test("original covers retain their epigraphs inside episodes and singleton titles stay exact", () => {
  const source = [
    "# 첫 이야기",
    "첫 상징문.\n\n— 작가, 『책』\n\n<!-- PAGE_BREAK -->",
    "# 1화. 첫 이야기 - 1",
    "## 시작\n\n첫 본문.",
    "# 2화. 첫 이야기 - 2",
    "## 다음\n\n둘째 본문.",
    "# 벽에도 이웃이 있다",
    "단편 상징문.\n\n<!-- PAGE_BREAK -->",
    "# 3화. 벽에도 이웃이 있다",
    "## 첫 근무일\n\n단편 본문.",
  ].join("\n\n");
  const { sections } = parseManuscript(source);
  assert.deepEqual(
    sections.map(({ episode, title, kind }) => ({ episode, title, kind })),
    [
      { episode: 1, title: "첫 이야기 - 1", kind: "episode" },
      { episode: 2, title: "첫 이야기 - 2", kind: "episode" },
      { episode: 3, title: "벽에도 이웃이 있다", kind: "episode" },
    ],
  );
  assert.match(sections[0].content, /첫 상징문\.[\s\S]*첫 본문\./);
  assert.match(sections[2].content, /단편 상징문\.[\s\S]*단편 본문\./);
});

test("interleaved explicit multipart titles retain their global part numbers", () => {
  const { sections } = parseManuscript(
    "# 37화. 다음 약속 - 1\n\n앞.\n\n# 꽃을 팔던 자리\n\n상징문.\n\n<!-- PAGE_BREAK -->\n\n# 38화. 꽃을 팔던 자리\n\n단편.\n\n# 39화. 다음 약속 - 2\n\n중간.\n\n# 40화. 다음 약속 - 3\n\n끝.\n",
  );
  assert.deepEqual(
    sections.map((section) => section.title),
    ["다음 약속 - 1", "꽃을 팔던 자리", "다음 약속 - 2", "다음 약속 - 3"],
  );
});

test("historical adapted covers and implicit arc numbering remain unchanged", () => {
  const { sections } = parseManuscript(
    "# 1화\n\n## 옛 아크\n\n상징문.\n\n<!-- PAGE_BREAK -->\n\n## 서울\n\n본문.\n\n# 2화\n\n계속.\n\n# 3화 — 다음 아크 1\n\n다음.\n\n# 4화. 기존 단편\n\n이전 표시 보존.\n",
  );
  assert.deepEqual(
    sections.map((section) => section.title),
    ["옛 아크 - 1", "옛 아크 - 2", "다음 아크 - 1", "기존 단편 - 1"],
  );
  assert.deepEqual(
    sections.map((section) => section.id),
    ["section-1", "section-2", "section-3", "section-4"],
  );
});

test("unrelated documents, introductions and guides remain separate", () => {
  const { introduction, sections } = parseManuscript(
    "# 비공개 열람본\n\n소개.\n\n# 설정집\n\n기준.\n\n# 별개 문서\n\n자료.\n\n<!-- PAGE_BREAK -->\n\n# 1화. 이야기 - 1\n\n본문.\n",
  );
  assert.equal(introduction, "소개.");
  assert.deepEqual(
    sections.map((section) => section.kind),
    ["guide", "document", "episode"],
  );
  assert.equal(sections[2].content, "본문.");
});

test("numbered large-chapter covers preserve their epigraphs without extra reader sections", () => {
  const source = [
    "# 5장. 도착하지 않은 도시 2",
    "상징문.\n\n— 강오희, 『빌려온 주소』\n\n<!-- PAGE_BREAK -->",
    "# 13화. 도착하지 않은 도시 2 - 1",
    "첫 본문.",
    "# 14화. 도착하지 않은 도시 2 - 2",
    "다음 본문.",
    "# 8장. 벽에도 이웃이 있다",
    "다른 상징문.\n\n<!-- PAGE_BREAK -->",
    "# 24화. 벽에도 이웃이 있다",
    "단편 본문.",
  ].join("\n\n");
  const { sections } = parseManuscript(source);
  assert.deepEqual(
    sections.map((s) => s.title),
    [
      "도착하지 않은 도시 2 - 1",
      "도착하지 않은 도시 2 - 2",
      "벽에도 이웃이 있다",
    ],
  );
  assert.match(
    sections[0].content,
    /5장\. 도착하지 않은 도시 2[\s\S]*상징문\.[\s\S]*첫 본문\./,
  );
  assert.equal(sections[2].title, "벽에도 이웃이 있다");
});
test("the exact Boundary H2 sequence is readable without changing stored source bytes", () => {
  const source =
    "# 《각자의 현실》\n## Reality Error: Boundary\n\n## 1화. 첫 이야기 - 1\n\n첫 본문.\n\n## 2화. 첫 이야기 - 2\n\n둘째 본문.\n";
  const original = source;
  const { sections } = parseManuscript(source);
  const episodes = sections.filter((s) => s.kind === "episode");
  assert.deepEqual(
    episodes.map((s) => [s.episode, s.title]),
    [
      [1, "첫 이야기 - 1"],
      [2, "첫 이야기 - 2"],
    ],
  );
  assert.equal(episodes[0].content, "첫 본문.");
  assert.equal(episodes[1].content, "둘째 본문.");
  assert.match(sections[0].content, /Reality Error: Boundary/);
  assert.equal(source, original);
});
test("raw MAIN subheadings supply each actual arc title, including a new singleton", () => {
  const { sections } = parseManuscript(
    "# 1화\n\n## 첫 아크 -1\n\n첫 본문.\n\n# 2화\n\n## 독립 이야기\n\n단편.\n",
  );
  assert.deepEqual(
    sections.map((s) => s.title),
    ["첫 아크 - 1", "독립 이야기 - 1"],
  );
  assert.match(sections[1].content, /단편\./);
});

test("arc H1 and consecutive episode H2 need no book cover marker", () => {
  const source = `${[
    "# 유리 정원",
    "## 1화. 유리 정원 - 1",
    "### 입구",
    "첫 문장.",
    "## 2화. 유리 정원 - 2",
    "### 출구",
    "둘째 문장.",
    "# 저녁 열차",
    "## 3화. 저녁 열차",
    "셋째 문장.",
  ].join("\n\n")}\n`;
  const original = source;
  const { sections } = parseManuscript(source);
  assert.deepEqual(
    sections.map((s) => [s.kind, s.episode, s.title]),
    [
      ["episode", 1, "유리 정원 - 1"],
      ["episode", 2, "유리 정원 - 2"],
      ["episode", 3, "저녁 열차"],
    ],
  );
  assert.match(sections[0].content, /첫 문장/);
  assert.match(sections[1].content, /둘째 문장/);
  assert.match(sections[2].content, /셋째 문장/);
  assert.equal(source, original);
});

test("arc epigraphs stay with the first episode and do not add sections", () => {
  const source = [
    "# 유리 정원",
    "> 합성 인용문.\n>\n> — 가상의 저자",
    "## 1화. 유리 정원 - 1",
    "첫 본문.",
    "## 2화. 유리 정원 - 2",
    "둘째 본문.",
    "# 저녁 열차",
    "> 다른 합성 인용문.",
    "## 3화. 저녁 열차 - 1",
    "셋째 본문.",
  ].join("\n\n");
  const { sections } = parseManuscript(source);
  assert.equal(sections.length, 3);
  assert.ok(sections.every((s) => s.kind === "episode"));
  assert.match(sections[0].content, /합성 인용문[\s\S]*첫 본문/);
  assert.doesNotMatch(sections[1].content, /합성 인용문/);
  assert.match(sections[2].content, /다른 합성 인용문[\s\S]*셋째 본문/);
});

test("missing, repeated, reordered and mismatched H2 headings remain documents", () => {
  const valid =
    "# 유리 정원\n\n## 1화. 유리 정원 - 1\n\n첫 문장.\n\n## 2화. 유리 정원 - 2\n\n다음 문장.\n";
  const invalid = [
    valid.replace("## 2화.", "## 3화."),
    valid.replace("## 2화.", "## 1화."),
    valid
      .replace("## 1화.", "## 2화.")
      .replace("## 2화. 유리 정원 - 2", "## 1화. 유리 정원 - 2"),
    valid.replace("## 2화. 유리 정원 - 2", "## 2화. 다른 제목 - 2"),
    valid.replace("## 2화. 유리 정원 - 2", "## 2화. 유리 정원 - 3"),
    `${valid}\n# 별도 문서\n\n설명.\n`,
    `${valid}\n## 일반 부록\n\n설명.\n`,
  ];
  for (const source of invalid) {
    assert.equal(
      parseManuscript(source).sections.filter((s) => s.kind === "episode")
        .length,
      0,
    );
  }
});

test("ordinary documents and MAIN H2 subheadings are not reclassified", () => {
  const source = "# 보고서\n\n## 1화. 예시\n\n자료.\n\n## 2화. 설명\n\n자료.\n";
  assert.equal(
    parseManuscript(source).sections.filter((s) => s.kind === "episode").length,
    0,
  );
  const main =
    "# 1화\n\n## 유리 정원 -1\n\n### 장면\n\n첫 본문.\n\n# 2화\n\n## 유리 정원 -2\n\n다음 본문.\n";
  const sections = parseManuscript(main).sections;
  assert.deepEqual(
    sections.map((s) => s.episode),
    [1, 2],
  );
  assert.deepEqual(
    sections.map((s) => s.title),
    ["유리 정원 - 1", "유리 정원 - 2"],
  );
});

test("numbered arc covers and CRLF preserve the same H2 sequence", () => {
  const source =
    "# 1장. 유리 정원\r\n\r\n## 1화. 유리 정원 - 1\r\n\r\n첫 본문.\r\n\r\n## 2화. 유리 정원 - 2\r\n\r\n둘째 본문.\r\n";
  const { sections } = parseManuscript(source);
  assert.deepEqual(
    sections.map((s) => [s.episode, s.title]),
    [
      [1, "유리 정원 - 1"],
      [2, "유리 정원 - 2"],
    ],
  );
});

test("legacy banner section IDs and saved annotation spans remain stable", () => {
  const body = "앞 문장. 인용할 문장. 뒤 문장.";
  const source = [
    "# 《각자의 현실》",
    "## Reality Error: Boundary",
    "## 1화. 유리 정원 - 1",
    body,
    "## 2화. 유리 정원 - 2",
    "다음 본문.",
  ].join("\n\n");
  const { sections } = parseManuscript(source);
  assert.deepEqual(
    sections.map(({ id, kind, episode }) => ({ id, kind, episode })),
    [
      { id: "section-1", kind: "document", episode: undefined },
      { id: "section-2", kind: "episode", episode: 1 },
      { id: "section-3", kind: "episode", episode: 2 },
    ],
  );
  const restored = sections.find((section) => section.id === "section-2");
  assert.equal(restored.content, body);
  const quote = "인용할 문장.";
  const offset = body.indexOf(quote);
  assert.equal(restored.content.slice(offset, offset + quote.length), quote);
});

test("compact arc part titles attach their epigraph exactly once", () => {
  const source =
    "# Arc\n\n> quote\n\n## 1화. Arc -1\n\nFirst\n\n## 2화. Arc -2\n\nSecond\n";
  const { sections } = parseManuscript(source);
  assert.equal(sections.length, 2);
  assert.ok(sections.every((section) => section.kind === "episode"));
  assert.deepEqual(
    sections.map((section) => [section.episode, section.title]),
    [
      [1, "Arc - 1"],
      [2, "Arc - 2"],
    ],
  );
  assert.equal(sections[0].content.match(/quote/g)?.length, 1);
  assert.match(sections[0].content, /First/);
  assert.doesNotMatch(sections[1].content, /quote/);
  assert.equal(sections[1].content, "Second");
});

for (const title of ["City 2", "City - 2"]) {
  test(`singleton arc title stays exact: ${title}`, () => {
    const source = [
      `# ${title}`,
      `## 1화. ${title}`,
      "First",
      "# Other",
      "## 2화. Other",
      "Second",
    ].join("\n\n");
    const { sections } = parseManuscript(source);
    assert.deepEqual(
      sections.map(({ id, kind, episode, title, content }) => ({
        id,
        kind,
        episode,
        title,
        content,
      })),
      [
        {
          id: "section-1",
          kind: "episode",
          episode: 1,
          title,
          content: "First",
        },
        {
          id: "section-2",
          kind: "episode",
          episode: 2,
          title: "Other",
          content: "Second",
        },
      ],
    );
  });
}
