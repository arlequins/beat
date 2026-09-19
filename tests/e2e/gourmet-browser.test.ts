import { expect, test } from "@playwright/test";

const entry = {
  area: "Tokyo",
  cookingMethods: [],
  cuisineTags: ["Japanese"],
  createdAt: "2026-09-07T12:00:00.000Z",
  discoveries: [],
  freeTextNote: null,
  id: "meal-1",
  images: [],
  ingredients: [],
  liked: [],
  menuName: "Tasting menu",
  nutritionTags: [],
  postMealNotes: [],
  rating: 8.5,
  restaurantBranch: "Shibuya",
  restaurantName: "Sample Table",
  revisit: "yes",
  revision: 1,
  slug: "sample-table",
  source: "manual",
  status: "published",
  summary: "A concise Gourmet fixture for the public browser.",
  tasteNotes: [],
  updatedAt: "2026-09-07T12:00:00.000Z",
  visitedAt: "2026-09-07",
};

test("filters Gourmet records and offers a safe Maps handoff", async ({
  page,
}) => {
  const requests: URL[] = [];
  await page.route("**/api/gourmet/entries?*", async (route) => {
    requests.push(new URL(route.request().url()));
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ entries: [entry], page: 1, total: 1 }),
    });
  });

  await page.goto("/gourmet/");
  await expect(
    page.getByRole("heading", { name: "Gourmet notes" }),
  ).toBeVisible();
  await expect(page.getByText("No photo", { exact: true })).toBeVisible();
  await expect(page.getByLabel("All cuisines")).toBeHidden();
  await page.getByText("Filters", { exact: true }).click();
  await page.getByLabel("All cuisines").selectOption("Japanese");
  await page.getByLabel("Any rating").selectOption("8");
  await page.getByLabel("Any revisit plan").selectOption("yes");

  await expect
    .poll(() =>
      requests.some(
        (request) =>
          request.searchParams.get("cuisineTag") === "Japanese" &&
          request.searchParams.get("minRating") === "8" &&
          request.searchParams.get("revisit") === "yes",
      ),
    )
    .toBe(true);

  const maps = page.getByRole("link", { name: "Open in Google Maps" });
  await expect(maps).toHaveCount(1);
  const href = await maps.getAttribute("href");
  expect(href).toContain("www.google.com/maps/search/");
  expect(href).toContain("Sample%20Table%20Shibuya%20Tokyo");
  await expect(maps).toHaveAttribute("rel", "noopener noreferrer");
  await expect(maps).toHaveAttribute("target", "_blank");
});

test("detail displays every photo in order and recovers transient image failures", async ({
  page,
}) => {
  const images = [2, 0, 1].map((sortOrder) => ({
    id: `image-${sortOrder}`,
    publicPath: `/api/gourmet/images/meal-1/${sortOrder}`,
    altText: "IMG_001.jpeg",
    byteSize: 100,
    sortOrder,
  }));
  await page.route("**/api/gourmet/entries?*", (route) =>
    route.fulfill({
      json: { entries: [{ ...entry, images }], page: 1, total: 1 },
    }),
  );
  await page.route("**/api/gourmet/entries/sample-table", (route) =>
    route.fulfill({ json: { ...entry, images } }),
  );
  let failedRequests = 0;
  await page.route("**/api/gourmet/images/**", (route) => {
    if (route.request().url().endsWith("/0")) {
      failedRequests++;
      return route.fulfill({ status: 500 });
    }
    return route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="green"/></svg>',
    });
  });
  await page.goto("/gourmet/?entry=sample-table");
  const gallery = page.getByRole("region", { name: "Photos", exact: true });
  await expect(gallery.getByRole("img")).toHaveCount(3);
  await expect(gallery.getByRole("img").first()).toHaveAttribute(
    "alt",
    "Sample Table · Tasting menu (1/3)",
  );
  for (const image of await gallery.getByRole("img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth))
      .toBeGreaterThan(0);
  }
  expect(failedRequests).toBeGreaterThan(0);
  await expect(gallery.getByRole("img").first()).toHaveAttribute(
    "src",
    /\/0\?retry=1$/,
  );
});

test("missing Gourmet detail shows an error with a route back", async ({
  page,
}) => {
  await page.route("**/api/gourmet/entries?*", (route) =>
    route.fulfill({ json: { entries: [entry], page: 1, total: 1 } }),
  );
  await page.route("**/api/gourmet/entries/missing", (route) =>
    route.fulfill({ status: 404 }),
  );
  await page.goto("/gourmet/?entry=missing");
  await expect(page.getByRole("status")).toHaveText(
    "Unable to load Gourmet records.",
  );
  await expect(page.getByRole("link", { name: "All records" })).toBeVisible();
  await expect(page.getByText("Sample Table")).toHaveCount(0);
});
