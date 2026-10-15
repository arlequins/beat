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
