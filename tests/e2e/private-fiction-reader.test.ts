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
    page.getByRole("link", { name: "작품으로 돌아가기" }),
  ).toHaveAttribute("href", "/private/fictions/");
  await expect(page.getByText("읽기 →")).toHaveCount(0);
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
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= window.innerHeight + 1,
    ),
  ).toBe(true);
  expect(
    await page.locator(".ebook-shell").evaluate((element) => ({
      shellHeight: element.clientHeight,
      contentHeight: element.scrollHeight,
      toolbar: getComputedStyle(element.querySelector(".ebook-toolbar")!)
        .display,
    })),
  ).toEqual({
    shellHeight: await page.evaluate(() => window.innerHeight),
    contentHeight: await page.evaluate(() => window.innerHeight),
    toolbar: "none",
  });
  expect(
    await viewport.evaluate((element) => ({
      overflowX: getComputedStyle(element).overflowX,
      top: element.getBoundingClientRect().top,
      height: element.clientHeight,
      margin: getComputedStyle(element).margin,
    })),
  ).toEqual({
    overflowX: "hidden",
    top: 0,
    height: await page.evaluate(() => window.innerHeight),
    margin: "0px",
  });

  const controls = page.locator(".private-fiction-book-controls");
  await expect(controls).toBeHidden();
  await viewport.dblclick();
  await expect(controls).toBeVisible();
  const controlsBox = await controls.boundingBox();
  const titleBox = await page
    .getByRole("heading", { name: "첫 번째 장면" })
    .boundingBox();
  expect(controlsBox).not.toBeNull();
  expect(titleBox).not.toBeNull();
  expect(titleBox!.y + titleBox!.height).toBeLessThanOrEqual(controlsBox!.y);
  await expect(controls.getByRole("link", { name: "Admin" })).toHaveAttribute(
    "href",
    "/admin/",
  );
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
  await page.getByRole("region", { name: /소설 본문/ }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveURL(/\/private\/fictions\/?\?episode=1$/);
  await expect(
    page.getByRole("heading", { name: "첫 번째 장면" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".private-fiction-book")).toBeVisible();
  const mobileViewport = page.locator(".private-fiction-book-viewport");
  if (test.info().project.name === "mobile-chrome") {
    await page.evaluate(() => {
      localStorage.setItem("beat-fiction-v1-book-position-section-2", "0");
    });
    await page.reload();
    const bounds = await mobileViewport.boundingBox();
    if (!bounds) throw new Error("Private fiction reader viewport is missing");
    await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + 140);
    await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + 140);
    await expect(controls).toBeVisible();
    const [currentPage, totalPages] = (await pageCounter.innerText())
      .split(" /")
      .map(Number);
    if (!currentPage || !totalPages || totalPages < 2)
      throw new Error("Private fiction test chapter must span multiple pages");
    const swipeForward = currentPage < totalPages;
    await mobileViewport.dispatchEvent("pointerdown", {
      pointerType: "touch",
      pointerId: 1,
      isPrimary: true,
      clientX: bounds.x + (swipeForward ? bounds.width - 24 : 24),
      clientY: bounds.y + 180,
    });
    await mobileViewport.dispatchEvent("pointerup", {
      pointerType: "touch",
      pointerId: 1,
      isPrimary: true,
      clientX: bounds.x + (swipeForward ? 24 : bounds.width - 24),
      clientY: bounds.y + 180,
    });
    await expect(pageCounter).toContainText(
      `${currentPage + (swipeForward ? 1 : -1)} / ${totalPages}`,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= window.innerHeight + 1,
      ),
    ).toBe(true);
  }
  await page.goto("/private-fiction/");
  await expect(page).toHaveURL(/\/private\/fictions\/$/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
