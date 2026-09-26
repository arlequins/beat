import { expect, test } from "@playwright/test";

test.use({ hasTouch: true });

test("book controls stay visible, turn pages, and apply reading theme", async ({
  page,
}) => {
  await page.goto("/ko/fiction/the-last-window/");
  await expect(
    page.locator('.book-controls button[aria-label="다음 페이지"]'),
  ).toBeEnabled();
  await expect(
    page.getByRole("navigation", { name: "책보기 내비게이션" }),
  ).toBeHidden();
  await page.locator(".book-viewport").focus();
  await page.keyboard.press("Enter");
  const next = page.getByRole("button", { name: "다음 페이지", exact: true });
  await expect(next).toBeEnabled();
  const bounds = await next.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerHeight),
  );
  await next.tap();
  await expect(page.locator(".book-page-number")).toHaveText(/^2 \/ /);
  await page.getByRole("button", { name: "뷰어 설정", exact: true }).click();
  await page.getByRole("button", { name: "어둡게", exact: true }).click();
  await expect(page.locator(".book-viewer")).toHaveClass(/viewer-night/);
  await expect(page.locator(".book-viewer")).toHaveCSS(
    "background-color",
    "rgb(0, 0, 0)",
  );
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(page.locator(".book-page-number")).toHaveText(/^2 \/ /);
  await page.getByRole("button", { name: "이전 페이지", exact: true }).click();
  await expect(page.locator(".book-page-number")).toHaveText(/^1 \/ /);
  await page
    .getByRole("button", { name: "밝은 배경으로 전환", exact: true })
    .tap();
  await expect(page.locator(".book-viewer")).toHaveClass(/viewer-paper/);
  await page
    .getByRole("button", { name: "어두운 배경으로 전환", exact: true })
    .tap();
  await page.setViewportSize({ width: 390, height: 640 });
  await expect(next).toBeEnabled();
  await next.tap();
  await expect(page.locator(".book-page-number")).toHaveText(/^2 \/ /);
  const resized = await next.boundingBox();
  expect(resized!.y + resized!.height).toBeLessThanOrEqual(640);
  await page.reload();
  await expect(page.locator(".book-viewer")).toHaveClass(/viewer-night/);
});

test("dark book theme colors the document safe areas and restores the site", async ({
  page,
}) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("arlequin-theme", "dark");
    } catch {
      // The app also follows the device preference when storage is unavailable.
    }
  });
  await page.goto("/ko/fiction/the-last-window/");

  const viewer = page.locator(".book-viewer");
  await expect(viewer).toHaveClass(/viewer-night/);
  await expect(viewer).toHaveCSS("background-color", "rgb(0, 0, 0)");
  await expect(page.locator("meta[name='viewport']")).toHaveAttribute(
    "content",
    /viewport-fit=cover/,
  );
  await expect(page.locator("html")).toHaveCSS(
    "background-color",
    "rgb(0, 0, 0)",
  );
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(0, 0, 0)",
  );
  await expect
    .poll(() =>
      page
        .locator('meta[name="theme-color"]')
        .evaluateAll((metas) =>
          metas.every((meta) => meta.getAttribute("content") === "#000000"),
        ),
    )
    .toBe(true);

  await page.goto("/ko/fiction/");
  await expect(page.locator("html")).toHaveCSS(
    "background-color",
    "rgb(17, 19, 38)",
  );
  await expect
    .poll(() =>
      page
        .locator('meta[name="theme-color"]')
        .evaluateAll((metas) =>
          metas.every((meta) => meta.getAttribute("content") === "#111326"),
        ),
    )
    .toBe(true);
});

test("fiction reader renders night mode before hydration by default", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.removeItem("beat-fiction-v1-preferences");
  });
  await page.route("**/_next/static/**/*.js", (route) => route.abort());
  await page.goto("/ko/fiction/the-last-window/", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.locator("html")).toHaveAttribute(
    "data-reader-theme",
    "night",
  );
  await expect(page.locator(".book-viewer")).toHaveClass(/viewer-night/);
  await expect(page.locator("html")).toHaveCSS(
    "background-color",
    "rgb(0, 0, 0)",
  );
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(0, 0, 0)",
  );
  await expect
    .poll(() =>
      page
        .locator('meta[name="theme-color"]')
        .evaluateAll((metas) =>
          metas.every((meta) => meta.getAttribute("content") === "#000000"),
        ),
    )
    .toBe(true);
});

test("fiction reader applies saved paper mode before hydration", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "beat-fiction-v1-preferences",
      JSON.stringify({ size: 18, line: 1.9, theme: "paper", font: "sans" }),
    );
  });
  await page.route("**/_next/static/**/*.js", (route) => route.abort());
  await page.goto("/ko/fiction/the-last-window/", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.locator("html")).toHaveAttribute(
    "data-reader-theme",
    "paper",
  );
  await expect(page.locator("html")).toHaveCSS(
    "background-color",
    "rgb(245, 240, 230)",
  );
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(245, 240, 230)",
  );
  await expect(page.locator(".book-viewer")).toHaveCSS(
    "background-color",
    "rgb(245, 240, 230)",
  );
});

test("comments reject profanity and mask spoiler text", async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("fiction-comments-test-cleared")) {
      localStorage.removeItem("beat-fiction-comments-v1-the-last-window");
      sessionStorage.setItem("fiction-comments-test-cleared", "true");
    }
  });
  await page.goto("/ko/fiction/the-last-window/");
  await page.locator(".book-viewport").focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "코멘트", exact: true }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("h2")).toHaveText("독자 코멘트");
  await dialog.getByLabel("닉네임").fill("독자");
  await dialog.getByLabel("댓글").fill("시-발이 들어간 댓글");
  await dialog.getByRole("button", { name: "댓글 등록" }).click();
  await expect(dialog.getByRole("alert")).toContainText("비속어");

  await dialog.getByLabel("댓글").fill("결말 공개");
  await dialog.getByLabel("스포일러 포함").check();
  await dialog.getByRole("button", { name: "댓글 등록" }).click();
  await expect(dialog.locator(".fiction-comment-spoiler")).toBeVisible();
  await expect(dialog.getByText("결말 공개", { exact: true })).toHaveCount(0);
  await dialog.locator(".fiction-comment-spoiler").click();
  await expect(dialog.getByText("결말 공개", { exact: true })).toBeVisible();

  await dialog.getByRole("button", { name: "닫기" }).click();
  await page.reload();
  await page.locator(".book-viewport").focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "코멘트", exact: true }).click();
  await expect(
    page.getByRole("dialog").locator(".fiction-comment-spoiler"),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("결말 공개", { exact: true }),
  ).toHaveCount(0);
});

test("library omits free labels", async ({ page }) => {
  await page.goto("/ko/fiction/");
  await expect(page.getByText("무료", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /여백의 사람들/ }).click();
  await expect(page.getByText("총 400화", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "40화. 돌아가는 물 5: 다음 배가 오는 날",
    }),
  ).toBeVisible();
});

test("library switches between novels before opening an episode", async ({
  page,
}) => {
  await page.goto("/ko/fiction/");
  await expect(page.locator(".novel-card")).toHaveCount(3);
  await page.getByRole("button", { name: /각자의 세계 단편선/ }).click();
  await expect(page.locator("#selected-novel-title")).toHaveText(
    "각자의 세계 단편선",
  );
  await page.getByRole("link", { name: "1화. 비가 그친 뒤의 집" }).click();
  await expect(page.locator('[itemprop="headline"]')).toHaveText(
    "비가 그친 뒤의 집",
  );
});

test("one-shot novels share one catalog collection", async ({ page }) => {
  await page.goto("/ko/fiction/");

  await page.getByRole("button", { name: /각자의 세계 단편선/ }).click();
  await expect(page.locator("#selected-novel-title")).toHaveText(
    "각자의 세계 단편선",
  );
  await expect(page.locator(".novel-world-row")).toContainText(
    "여러 세계관 · 각자의 세계 단편선",
  );
  await expect(page.getByText("총 13화", { exact: true })).toBeVisible();
  for (const episodeTitle of [
    "비가 그친 뒤의 집",
    "새벽 네 시의 우편함",
    "이름을 빌려드립니다",
  ]) {
    await expect(
      page.getByRole("link", { name: `1화. ${episodeTitle}` }),
    ).toBeVisible();
  }
});

test("library keeps the three top-level collections", async ({ page }) => {
  await page.goto("/ko/fiction/");
  await expect(page.locator(".novel-card")).toHaveCount(3);
  await expect(page.locator(".novel-card").nth(2)).toContainText(
    "각자의 세계 단편선",
  );
  await expect(page.locator(".novel-card").nth(2)).toContainText("13화");
});

test("story body is exposed as a semantic article for iPhone Reader", async ({
  page,
}) => {
  await page.goto("/ko/fiction/the-last-window/");
  const article = page.locator(
    'article.book-flow[itemtype="https://schema.org/Article"]',
  );
  await expect(article).toHaveCount(1);
  await expect(article.locator('[itemprop="headline"]')).toHaveText(
    "마지막 창문",
  );
  await expect(
    article.locator('meta[itemprop="datePublished"]'),
  ).toHaveAttribute("content", "2026-09-12");
  const body = article.locator('[itemprop="articleBody"]');
  await expect(body.locator("p").first()).toContainText(
    "항복한 성의 창을 막으려면",
  );
  expect((await body.innerText()).length).toBeGreaterThan(1000);
});

test("book repaginates when body content arrives after initial layout", async ({
  page,
}) => {
  await page.goto("/ko/fiction/the-last-window/");
  await expect(
    page.locator('.book-controls button[aria-label="다음 페이지"]'),
  ).toBeEnabled();
  await expect(
    page.getByRole("navigation", { name: "책보기 내비게이션" }),
  ).toBeHidden();
  await page.locator(".book-viewport").focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "다음 페이지", exact: true }),
  ).toBeEnabled();
  await page.evaluate(() => {
    const flow = document.querySelector(".book-flow")!;
    const extra = document.createElement("div");
    extra.id = "late-reader-content";
    for (let i = 0; i < 100; i++) {
      const paragraph = document.createElement("p");
      paragraph.textContent =
        "뒤늦게 표시된 본문도 다음 페이지로 이어져야 한다. ".repeat(8);
      extra.append(paragraph);
    }
    flow.append(extra);
  });
  await expect
    .poll(async () => {
      const label = await page.locator(".book-page-number").textContent();
      return Number(label?.split("/")[1]);
    })
    .toBeGreaterThan(30);
  await page.getByRole("button", { name: "다음 페이지", exact: true }).tap();
  await expect(page.locator(".book-page-number")).toHaveText(/^2 \/ /);
});

test("reader double tap reveals tools without changing page geometry", async ({
  page,
}) => {
  await page.goto("/ko/fiction/the-last-window/");
  await expect(
    page.locator('.book-controls button[aria-label="다음 페이지"]'),
  ).toBeEnabled();
  const body = page.locator(".book-viewport");
  const before = await body.boundingBox();
  await body.tap({ position: { x: 100, y: 180 } });
  await body.tap({ position: { x: 100, y: 180 } });
  await expect(
    page.getByRole("navigation", { name: "책보기 내비게이션" }),
  ).toBeVisible();
  expect(await body.boundingBox()).toEqual(before);
  await page.getByRole("button", { name: "내비게이션 숨기기" }).tap();
  await expect(
    page.getByRole("navigation", { name: "책보기 내비게이션" }),
  ).toBeHidden();
});

test("setting guide reads all world documents without entering the story viewer", async ({
  page,
}) => {
  await page.goto("/ko/fiction/");
  await page.getByRole("button", { name: /여백의 사람들/ }).click();
  await page.getByRole("link", { name: "세계관·설정집 읽기 →" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "세계부터, 하나씩",
  );
  const links = await page
    .locator(".guide-contents a")
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("href")),
    );
  expect(links).toHaveLength(19);
  for (const href of links) {
    await page.goto(href!);
    await expect(page.locator(".guide-status")).toContainText("설정집");
    await expect(page.locator(".book-viewer")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "이 문서의 마크다운 원본" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("link", { name: "설정집 목차", exact: true }).click();
  await expect(page.locator(".guide-contents li")).toHaveCount(19);
});

test("near-future novel has its own guide and twenty-episode reading order", async ({
  page,
}) => {
  await page.goto("/ko/fiction/");
  await page.getByRole("button", { name: /내일의 생활비/ }).click();
  await expect(page.locator("#selected-novel-title")).toHaveText(
    "내일의 생활비",
  );
  test.setTimeout(90_000);
  await expect(page.getByText("총 20화", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "세계관·설정집 읽기 →" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "조금 먼저 온 일상",
  );
  await expect(page.locator(".guide-prose")).toContainText("2041년");
  await page.getByRole("link", { name: "1화 읽기" }).click();
  const slugs = [
    "tomorrow-seoul-table",
    "tomorrow-mumbai-rain",
    "tomorrow-lagos-spares",
    "tomorrow-sao-paulo-hour",
    "tomorrow-london-empty",
    "tomorrow-seoul-rooftop",
    "tomorrow-tokyo-stop",
    "tomorrow-mumbai-umbrella",
    "tomorrow-lagos-opening",
    "tomorrow-london-subtitles",
    "tomorrow-sao-paulo-saturday",
    "tomorrow-seoul-rehearsal",
    "tomorrow-istanbul-morning",
    "tomorrow-seoul-photograph",
    "tomorrow-mumbai-two-dinners",
    "tomorrow-lagos-after-closing",
    "tomorrow-sao-paulo-alone",
    "tomorrow-london-arrival",
    "tomorrow-seven-cities",
    "tomorrow-seoul-again",
  ];
  for (const [index, slug] of slugs.entries()) {
    await expect(page).toHaveURL(new RegExp(`/fiction/${slug}/$`));
    await expect(page.locator(".book-title")).toContainText(
      `내일의 생활비 · ${index + 1}화`,
    );
    expect(
      (await page.locator('[itemprop="articleBody"]').innerText()).length,
    ).toBeGreaterThan(1800);
    const next = page.getByRole("link", { name: "다음 이야기", exact: true });
    if (index < slugs.length - 1) {
      await expect(next).toHaveAttribute(
        "href",
        `/ko/fiction/${slugs[index + 1]}/`,
      );
      // Follow the end-of-story destination without swiping through every page.
      await page.goto((await next.getAttribute("href"))!);
    } else {
      await expect(next).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: "작품 목록으로", exact: true }),
      ).toHaveAttribute("href", "/ko/fiction/");
    }
  }
});
