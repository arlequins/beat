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

test("library omits free labels", async ({ page }) => {
  await page.goto("/ko/fiction/");
  await expect(page.getByText("무료", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /여백의 사람들/ }).click();
  await expect(page.getByText("총 40화", { exact: true })).toBeVisible();
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
  await expect(page.locator(".novel-card")).toHaveCount(15);
  await page.getByRole("button", { name: /낮은 지붕 아래/ }).click();
  await expect(page.locator("#selected-novel-title")).toHaveText(
    "낮은 지붕 아래",
  );
  await page.getByRole("link", { name: "1화. 비가 그친 뒤의 집" }).click();
  await expect(page.locator('[itemprop="headline"]')).toHaveText(
    "비가 그친 뒤의 집",
  );
});

test("independent one-shot novels keep separate world labels", async ({
  page,
}) => {
  await page.goto("/ko/fiction/");

  for (const [novel, episodeTitle] of [
    ["우편함의 계절", "새벽 네 시의 우편함"],
    ["마지막 환승", "마지막 환승 안내방송"],
  ]) {
    await page.getByRole("button", { name: new RegExp(novel) }).click();
    await expect(page.locator("#selected-novel-title")).toHaveText(novel);
    await expect(page.locator(".novel-world-row")).toContainText(
      `새 세계관 · ${novel} 세계관`,
    );
    await expect(
      page.getByRole("link", { name: `1화. ${episodeTitle}` }),
    ).toBeVisible();
  }
});

test("library includes ten new category one-shots", async ({ page }) => {
  await page.goto("/ko/fiction/");

  for (const [novel, category] of [
    ["식탁 아래의 별", "문학 · 가족"],
    ["여섯 번째 열쇠", "미스터리 · 단편"],
    ["구름 보관소", "기후 SF · 단편"],
    ["기억보다 늦은 답장", "로맨스 · 단편"],
    ["숲의 이름을 빌린 날", "판타지 · 우화"],
    ["벽 너머의 발소리", "심리 공포 · 단편"],
    ["사라진 역참의 등불", "시대극 · 단편"],
    ["파란 섬의 마지막 지도", "해양 모험 · 단편"],
    ["퇴근하지 않는 엘리베이터", "오피스 코미디 · 단편"],
    ["이름을 빌려드립니다", "디스토피아 · 사회"],
  ]) {
    const card = page.locator(".novel-card").filter({ hasText: novel });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText(category);
    await expect(card).toContainText("새 세계관");
  }
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
  expect(links).toHaveLength(18);
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
  await expect(page.locator(".guide-contents li")).toHaveCount(18);
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
