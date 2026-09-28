import { expect, test } from "@playwright/test";

const longChapter = Array.from(
  { length: 36 },
  (_, index) =>
    `터널 바깥의 비는 그치지 않았다. ${index + 1}번째 기록에는 누가 먼저 문을 열었는지 적혀 있었지만, 다음 줄에는 같은 시각에 아무도 출입하지 않았다고 쓰여 있었다. 도윤은 서로 다른 기록을 한 장씩 펼쳐 놓고 사람의 이름과 시간을 다시 확인했다.`,
).join("\n\n");
const manuscript = [
  "# 《현실 오류》 비공개 열람본",
  "개인 열람용 소개 문장입니다.",
  "# 《현실 오류》 정본 설정집",
  "## 세계의 기준",
  "이 문서는 **설정**을 읽기 좋게 보여 줍니다.",
  "# 1화 — 첫 번째 장면",
  longChapter,
  "# 2화 — 다음 장면",
  "두 번째 회차 본문입니다.",
].join("\n\n");

test("reads private Markdown in the public book-style page-turn viewer", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "beat-admin-session",
      JSON.stringify({
        accessExpiresAt: Date.now() + 60 * 60 * 1000,
        accessToken: "private-fiction-test-token",
        refreshExpiresAt: Date.now() + 2 * 60 * 60 * 1000,
        refreshToken: "private-fiction-test-refresh-token",
      }),
    );
  });
  await page.route("**/admin/private-fiction", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        etag: "test-etag",
        source: manuscript,
        updatedAt: "2026-09-27T12:00:00.000Z",
      }),
    }),
  );

  await page.goto("/private/fictions/");
  await expect(
    page.getByRole("heading", { name: "비공개 소설" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "현실 오류" })).toBeVisible();
  await page.getByRole("link", { name: "회차 목록 보기" }).click();
  await expect(page).toHaveURL(/\/private\/fictions\/list\/$/);
  await expect(
    page.getByRole("button", { name: /1화\. 첫 번째 장면/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /2화\. 다음 장면/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /1화\. 첫 번째 장면/ }).click();
  await expect(page).toHaveURL(/\/private\/fictions\/?\?episode=1$/);
  const viewport = page.locator(".private-fiction-book-viewport");
  await expect(viewport).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "첫 번째 장면" }),
  ).toBeVisible();
  await expect(page.locator(".private-fiction-toc")).toHaveCount(0);

  const controls = page.locator(".private-fiction-book-controls");
  await expect(controls).toBeHidden();
  await viewport.dblclick();
  await expect(controls).toBeVisible();
  await expect(
    controls.getByRole("link", { name: "관리자 로그인" }),
  ).toHaveAttribute("href", "/admin/");
  await viewport.dblclick();
  await expect(controls).toBeHidden();
  await viewport.focus();
  await page.keyboard.press("Enter");
  const pageCounter = page.locator(
    ".private-fiction-book-controls .book-page-number",
  );
  await expect(pageCounter).toContainText(/1 \/ \d+/);
  const viewportWidth = await viewport.evaluate(
    (element) => element.clientWidth,
  );
  await viewport.click({ position: { x: viewportWidth * 0.9, y: 340 } });
  await expect(pageCounter).toContainText(/2 \/ \d+/);
  await viewport.click({ position: { x: viewportWidth * 0.1, y: 340 } });
  await expect(pageCounter).toContainText(/1 \/ \d+/);

  await pageCounter.click();
  const contents = page.getByRole("dialog");
  await expect(contents.getByRole("heading", { name: "목차" })).toBeVisible();
  await expect(
    contents.getByRole("button", { name: /2화\. 다음 장면/ }),
  ).toBeVisible();
  await contents.getByRole("button", { name: /2화\. 다음 장면/ }).click();
  await expect(page).toHaveURL(/\/private\/fictions\/?\?episode=2$/);
  await expect(page.getByRole("heading", { name: "다음 장면" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".private-fiction-book")).toBeVisible();
  await page.goto("/private-fiction/");
  await expect(page).toHaveURL(/\/private\/fictions\/$/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
