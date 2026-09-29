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
  "# 1화 — 편의점의 두 손님 1",
  longChapter,
  "# 2화 — 편의점의 두 손님 2",
  "두 번째 회차 본문입니다.",
  "# 3화 — 세 번째 장면",
  "세 번째 회차 본문입니다.",
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
  await page.route("**/admin/private-fiction/annotations", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ etag: null, annotations: [], updatedAt: null }),
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
    page.getByRole("button", {
      name: "편의점의 두 손님 1",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "편의점의 두 손님 2",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "3화. 세 번째 장면" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "편의점의 두 손님 1", exact: true })
    .click();
  await expect(page).toHaveURL(/\/private\/fictions\/?\?episode=1$/);
  const viewport = page.locator(".private-fiction-book-viewport");
  await expect(viewport).toBeVisible();
  await expect(viewport).toHaveAttribute("data-layout-ready", "true");
  await expect(
    page.getByRole("heading", {
      name: "편의점의 두 손님 1",
      exact: true,
    }),
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
      touchAction: getComputedStyle(element).touchAction,
      top: element.getBoundingClientRect().top,
      height: element.clientHeight,
      margin: getComputedStyle(element).margin,
    })),
  ).toEqual({
    overflowX: "hidden",
    touchAction: "pinch-zoom",
    top: 0,
    height: await page.evaluate(() => window.innerHeight),
    margin: "0px",
  });
  expect(
    await viewport.locator(".book-flow").evaluate((element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      const viewport = document.querySelector(
        ".private-fiction-book-viewport",
      )!;
      return {
        left: box.left,
        width: element.clientWidth,
        viewportWidth: viewport.clientWidth,
        marginLeft: style.marginLeft,
        paddingTop: style.paddingTop,
        paddingBottom: style.paddingBottom,
        columnGap: style.columnGap,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
      };
    }),
  ).toEqual({
    left: 24,
    width: await viewport.evaluate((element) => element.clientWidth - 48),
    viewportWidth: await viewport.evaluate((element) => element.clientWidth),
    marginLeft: "24px",
    paddingTop: "24px",
    paddingBottom: "24px",
    columnGap: "48px",
    scrollHeight: await viewport.evaluate((element) => element.clientHeight),
    clientHeight: await viewport.evaluate((element) => element.clientHeight),
  });

  const controls = page.locator(".private-fiction-book-controls");
  await expect(controls).toBeHidden();
  await expect(controls).toHaveCSS("display", "none");
  await expect(viewport.locator(".book-flow")).toHaveCSS("padding-top", "24px");
  await viewport.dblclick();
  await expect(controls).toBeVisible();
  await expect(controls).toHaveCSS("display", "flex");
  await expect(viewport.locator(".book-flow")).toHaveCSS("padding-top", "24px");
  const controlsBox = await controls.boundingBox();
  const titleBox = await page
    .getByRole("heading", {
      name: "편의점의 두 손님 1",
      exact: true,
    })
    .boundingBox();
  expect(controlsBox).not.toBeNull();
  expect(titleBox).not.toBeNull();
  expect(controlsBox!.y).toBeLessThan(16);
  expect(titleBox!.y).toBeGreaterThanOrEqual(24);
  await expect(controls.getByRole("link", { name: "Admin" })).toHaveAttribute(
    "href",
    "/admin/",
  );
  await controls.getByRole("button", { name: "읽기 설정" }).click();
  const readerSettings = page.getByRole("dialog");
  await expect(
    readerSettings.getByRole("heading", { name: "읽기 설정" }),
  ).toBeVisible();
  await readerSettings.getByRole("button", { name: "명조" }).click();
  await readerSettings.locator('input[type="range"]').first().press("End");
  await expect(readerSettings.locator("output").first()).toHaveText("28px");
  await expect(page.locator(".private-fiction-prose").first()).toHaveCSS(
    "font-size",
    "28px",
  );
  await expect(page.locator(".private-fiction-prose").first()).toHaveCSS(
    "font-family",
    /AppleMyungjo/,
  );
  await readerSettings.getByRole("button", { name: "닫기" }).click();
  await expect(readerSettings).toBeHidden();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("beat-fiction-v1-preferences") ?? "{}"),
    ),
  ).toMatchObject({ font: "serif", size: 28 });
  await expect(controls).toBeHidden();
  await expect(viewport.locator(".book-flow")).toHaveCSS("padding-top", "24px");
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
    contents.getByRole("button", {
      name: "편의점의 두 손님 2",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    contents.getByRole("button", { name: "3화. 세 번째 장면" }),
  ).toBeVisible();
  await page.evaluate(() => {
    sessionStorage.setItem("private-fiction-toolbar-flashes", "");
    const shell = document.querySelector(".ebook-shell");
    if (!shell) throw new Error("The ebook shell is missing");
    const observer = new MutationObserver(() => {
      const toolbar = document.querySelector(".ebook-toolbar");
      if (toolbar && getComputedStyle(toolbar).display !== "none") {
        sessionStorage.setItem(
          "private-fiction-toolbar-flashes",
          `${sessionStorage.getItem("private-fiction-toolbar-flashes")}1`,
        );
      }
    });
    observer.observe(shell, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 3000);
  });
  await contents
    .getByRole("button", { name: "편의점의 두 손님 2", exact: true })
    .click();
  await expect(page).toHaveURL(/\/private\/fictions\/?\?episode=2$/);
  await expect(
    page.getByRole("heading", { name: "편의점의 두 손님 2" }),
  ).toBeVisible();
  await expect(viewport).toHaveAttribute("data-layout-ready", "true");
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("private-fiction-toolbar-flashes"),
    ),
  ).toBe("");

  await page.evaluate(() => {
    const spacer = document.createElement("div");
    spacer.dataset.testScrollSpacer = "true";
    Object.assign(spacer.style, {
      height: "200vh",
      left: "0",
      pointerEvents: "none",
      position: "absolute",
      top: "0",
      width: "1px",
    });
    document.documentElement.style.scrollBehavior = "auto";
    document.body.append(spacer);
    window.scrollTo(0, 250);
  });
  expect(await page.evaluate(() => window.scrollY)).toBe(250);
  await page.getByRole("region", { name: /소설 본문/ }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveURL(/\/private\/fictions\/?\?episode=1$/);
  await expect(
    page.getByRole("heading", {
      name: "편의점의 두 손님 1",
      exact: true,
    }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(250);
  await page.evaluate(() => {
    document.querySelector("[data-test-scroll-spacer]")?.remove();
    document.documentElement.style.removeProperty("scroll-behavior");
    window.scrollTo(0, 0);
  });
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

test("anchors private reader feedback to highlighted prose and reloads it", async ({
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
        source:
          "# 1화 — 첫 번째 장면\n\n터널 바깥의 비는 그치지 않았다. 도윤은 기록을 다시 읽었다.",
        updatedAt: "2026-09-27T12:00:00.000Z",
      }),
    }),
  );

  let etag: string | null = null;
  let annotations: unknown[] = [];
  await page.route("**/admin/private-fiction/annotations", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ etag, annotations, updatedAt: null }),
      });
      return;
    }
    const body = route.request().postDataJSON() as {
      annotations: unknown[];
    };
    annotations = body.annotations;
    etag = '"feedback-1"';
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        etag,
        annotations,
        updatedAt: "2026-09-29T00:00:00.000Z",
      }),
    });
  });

  await page.goto("/private/fictions/?episode=1");
  await expect(
    page.getByRole("heading", { name: "첫 번째 장면" }),
  ).toBeVisible();
  const paragraph = page.locator(
    ".book-article-body [data-feedback-block-index]",
  );
  await paragraph.first().evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const text = walker.nextNode();
    if (!text) throw new Error("Paragraph text node is missing");
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 6);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });

  await expect(
    page.getByRole("region", { name: "선택한 원고에 의견 남기기" }),
  ).toBeVisible();
  await expect(
    page.locator(".private-fiction-feedback-composer blockquote"),
  ).toHaveText("터널 바깥의");
  await page
    .getByRole("textbox", { name: "코멘트" })
    .fill("이 문장을 더 구체적으로 다듬어 주세요.");
  await page.getByRole("button", { name: "피드백 저장" }).click();
  await expect(page.locator("mark[data-feedback-highlight]")).toHaveText(
    "터널 바깥의",
  );
  expect(annotations).toHaveLength(1);

  await page.reload();
  await expect(page.locator("mark[data-feedback-highlight]")).toHaveText(
    "터널 바깥의",
  );
  await page.locator(".private-fiction-book-viewport").dblclick();
  await page.getByRole("button", { name: "회차 피드백 1개" }).click();
  const feedback = page.getByRole("dialog");
  await expect(
    feedback.getByText("이 문장을 더 구체적으로 다듬어 주세요."),
  ).toBeVisible();
});
