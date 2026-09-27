import { expect, test } from "@playwright/test";

const manuscript = [
  "# 《현실 오류》 비공개 열람본",
  "개인 열람용 소개 문장입니다.",
  "# 정본 설정집",
  "# 《현실 오류》 정본 설정집",
  "## 세계의 기준",
  "이 문서는 **설정**을 읽기 좋게 보여 줍니다.",
  "# 1화 — 첫 번째 장면",
  "첫 회차 본문입니다.",
  "# 2화 — 다음 장면",
  ...Array.from(
    { length: 40 },
    (_, index) =>
      `두 번째 회차의 ${index + 1}번째 장면입니다. 인물은 눈앞의 기록을 확인하고, 다음 문장이 이어질 자리를 남겨 둡니다.`,
  ),
].join("\n\n");

test("renders the private Markdown as a navigable fiction reader", async ({
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

  await page.goto("/private-fiction");
  await expect(
    page.getByRole("heading", { name: "비공개 원고 보관함" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "현실 오류" })).toBeVisible();
  await page.getByRole("button", { name: /정본 설정집/ }).click();
  await expect(
    page.getByRole("heading", { name: "정본 설정집" }),
  ).toBeVisible();
  await expect(page.locator(".private-fiction-prose strong")).toHaveText(
    "설정",
  );
  await page.getByRole("button", { name: /목차/ }).click();
  await expect(page.getByRole("button", { name: /1화/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /2화/ })).toBeVisible();

  await page.getByRole("button", { name: /2화/ }).click();
  await expect(
    page.getByRole("dialog", { name: "비공개 책 읽기" }),
  ).toBeVisible();
  await expect(page.locator(".private-fiction-book-reader")).toHaveClass(
    /book-viewer/,
  );
  await expect(
    page.getByRole("heading", { name: "2화 — 다음 장면" }),
  ).toBeVisible();
  await expect(page.locator(".private-fiction-page-nav span")).not.toHaveText(
    "1 / 1",
  );
  const desktopViewport = page.getByRole("region", { name: "책 페이지" });
  const desktopBounds = await desktopViewport.boundingBox();
  if (!desktopBounds) throw new Error("The reading page is not visible.");
  await page.mouse.click(
    desktopBounds.x + desktopBounds.width * 0.75,
    desktopBounds.y + desktopBounds.height / 2,
  );
  await expect(page.locator(".private-fiction-page-nav span")).toHaveText(
    /2 \/ \d+/,
  );
  await page.mouse.click(
    desktopBounds.x + desktopBounds.width * 0.25,
    desktopBounds.y + desktopBounds.height / 2,
  );
  await expect(page.locator(".private-fiction-page-nav span")).toHaveText(
    /1 \/ \d+/,
  );
  await page.getByRole("button", { name: "다음 페이지" }).click();
  await expect(page.locator(".private-fiction-page-nav span")).toHaveText(
    /2 \/ \d+/,
  );
  await page.getByRole("region", { name: "책 페이지" }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".private-fiction-page-nav span")).toHaveText(
    /1 \/ \d+/,
  );
  await page.getByRole("button", { name: "다음 페이지" }).click();
  await expect(page.locator(".private-fiction-page-nav span")).toHaveText(
    /2 \/ \d+/,
  );
  await page.getByRole("button", { name: /이전 문서/ }).click();
  await expect(
    page.getByRole("heading", { name: "1화 — 첫 번째 장면" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /목차/ }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".private-fiction-toc")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  if (test.info().project.name === "mobile-chrome") {
    await page.getByRole("button", { name: /2화/ }).click();
    const viewport = page.getByRole("region", { name: "책 페이지" });
    const bounds = await viewport.boundingBox();
    if (!bounds) throw new Error("The reading page is not visible.");
    await page.touchscreen.tap(
      bounds.x + bounds.width * 0.75,
      bounds.y + bounds.height / 2,
    );
    await expect(page.locator(".private-fiction-page-number")).toHaveText(
      /2 \/ \d+/,
    );
    await page.touchscreen.tap(
      bounds.x + bounds.width * 0.25,
      bounds.y + bounds.height / 2,
    );
    await expect(page.locator(".private-fiction-page-number")).toHaveText(
      /1 \/ \d+/,
    );
  }
});
