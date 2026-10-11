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
