import { readdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const locales = ["ko", "en", "ja"] as const;
const postSlugs = readdirSync("apps/web/content/posts")
  .filter((file) => file.endsWith(".mdx"))
  .map((file) => file.slice(0, -4))
  .sort();
const workSlugs = [
  "agent-assisted-product-workflow",
  "beat-template",
  "portfolio-as-a-product",
];

for (const locale of locales) {
  const prefix = locale === "en" ? "" : `/${locale}`;

  test(`${locale} public sections fit the viewport`, async ({ page }) => {
    const paths = [
      `${prefix}/`,
      `${prefix}/posts/`,
      `${prefix}/characters/`,
      ...workSlugs.map((slug) => `${prefix}/work/${slug}/`),
    ];
    for (const path of paths) {
      const response = await page.goto(path);
      expect(response?.ok(), `${locale}${path} should load`).toBe(true);
      await expect(page.locator("main h1")).toBeVisible();
      const width = await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      );
      expect(width, `${locale}${path} horizontal overflow`).toBe(true);
    }
  });

  test(`${locale} post pages load without narrow-screen overflow`, async ({
    page,
  }) => {
    for (const slug of postSlugs) {
      const response = await page.goto(`${prefix}/posts/${slug}/`);
      expect(response?.ok(), `${locale}/${slug} should load`).toBe(true);
      await expect(page.locator("main h1")).toBeVisible();
      const layout = await page.evaluate(() => {
        const heading = document.querySelector("main h1");
        return {
          headingRight: heading?.getBoundingClientRect().right ?? 0,
          scrollWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        };
      });
      expect(
        layout.scrollWidth,
        `${locale}/${slug} horizontal overflow`,
      ).toBeLessThanOrEqual(layout.viewportWidth);
      expect(
        layout.headingRight,
        `${locale}/${slug} title overflow`,
      ).toBeLessThanOrEqual(layout.viewportWidth);
    }
  });
}

const gourmetEntry = {
  id: "localization-entry",
  slug: "gourmet-9b882654",
  restaurantName: "自家製麺 啜乱会",
  restaurantBranch: null,
  menuName: "特製鶏そば",
  area: "신코이와",
  summary: "닭고기와 국물을 함께 먹을 때 구운 향이 나는 닭 소바",
  rating: 8,
  revisit: "yes",
  source: "manual",
  visitedAt: "2026-08-04",
  createdAt: "2026-08-04T00:00:00Z",
  updatedAt: "2026-08-04T00:00:00Z",
  revision: 1,
  status: "published",
  cuisineTags: ["일본 요리"],
  tasteNotes: ["구운 향", "감칠맛"],
  liked: ["고기와 국물을 함께 먹었을 때 느껴지는 구운 향"],
  discoveries: ["메뉴가 많아 무엇을 골라야 할지 어려웠음"],
  ingredients: ["닭", "면"],
  cookingMethods: [],
  nutritionTags: [],
  postMealNotes: [],
  freeTextNote: null,
  images: [],
};

for (const locale of ["en", "ja"] as const) {
  test(`${locale} Gourmet translates records and keeps API filters stable`, async ({
    page,
  }) => {
    const requestedAreas: string[] = [];
    await page.route(/\/api\/gourmet\/entries\/gourmet-9b882654$/, (route) =>
      route.fulfill({ json: gourmetEntry }),
    );
    await page.route(/\/api\/gourmet\/entries(?:\?.*)?$/, (route) => {
      const url = new URL(route.request().url());
      const area = url.searchParams.get("area");
      if (area) requestedAreas.push(area);
      return route.fulfill({
        json: { entries: [gourmetEntry], page: 1, total: 1 },
      });
    });

    const prefix = `/${locale}`;
    await page.goto(`${prefix}/gourmet/`);
    const menuName = locale === "en" ? "Special chicken soba" : "特製鶏そば";
    await expect(page.getByText(menuName, { exact: true })).toBeVisible();
    await page.locator(".gourmet-filter-details summary").click();
    const areaFilter = page.getByRole("combobox", {
      name: locale === "en" ? "All areas" : "すべてのエリア",
    });
    await expect(
      areaFilter.getByRole("option", {
        name: locale === "en" ? "Shinkoiwa, Tokyo" : "東京都・新小岩",
      }),
    ).toBeAttached();
    await areaFilter.selectOption("신코이와");
    await expect.poll(() => requestedAreas).toContain("신코이와");

    await page.goto(`${prefix}/gourmet/?entry=gourmet-9b882654`);
    const summary =
      locale === "en"
        ? "The chicken soba has a pleasant roasted aroma when the chicken and broth are enjoyed together."
        : "鶏肉とスープを一緒に味わうと、香ばしさが広がる鶏そばです。";
    await expect(page.getByText(summary, { exact: true })).toBeVisible();
    await expect(page.locator("article")).toContainText(
      locale === "en" ? "Manual" : "手動記録",
    );
    const width = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(width).toBe(true);
  });
}
