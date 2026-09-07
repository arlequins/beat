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
