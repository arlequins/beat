import { expect, test } from "@playwright/test";

test("mobile article titles stay readable without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  for (const path of [
    "/posts/weekly-it-brief-2026-09-14/",
    "/ko/posts/weekly-it-brief-2026-09-14/",
    "/work/portfolio-as-a-product/",
  ]) {
    await page.goto(path);
    const title = page.getByRole("heading", { level: 1 });
    await expect(title).toBeVisible();
    const size = await title.evaluate((node) =>
      Number.parseFloat(getComputedStyle(node).fontSize),
    );
    expect(size).toBeGreaterThanOrEqual(28);
    expect(size).toBeLessThanOrEqual(32);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
  }
});

test("writing search and topic filters narrow the published notes", async ({
  page,
}) => {
  await page.goto("/posts/");
  const search = page.getByRole("searchbox", { name: "Search notes" });
  await page.getByRole("button", { name: "Weekly IT Brief" }).click();
  await search.fill("Matching operations");
  await expect(
    page.getByRole("link", {
      name: "Weekly IT Brief — Matching operations to a shorter release rhythm",
    }),
  ).toBeVisible();
  await expect(page.locator("article")).toHaveCount(1);

  await search.fill("no matching note should have this phrase");
  await expect(page.getByText("No notes match your search.")).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page.getByRole("article")).not.toHaveCount(0);
});

test("localized post metadata follows the rendered English article", async ({
  page,
}) => {
  await page.goto("/posts/weekly-it-brief-2026-09-14/");
  await expect(page).toHaveTitle(
    "Weekly IT Brief — Matching operations to a shorter release rhythm | Arlequin",
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /A developer's view of Chrome's two-week cadence/,
  );
});

test("project case studies show their outcome and a real primary destination", async ({
  page,
}) => {
  await page.goto("/work/agent-assisted-product-workflow/");
  await expect(page.getByRole("heading", { name: "Challenge" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "What I built" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Outcome" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View GitHub repository" }),
  ).toHaveAttribute("href", "https://github.com/arlequins/beat-agent");

  await page.goto("/work/portfolio-as-a-product/");
  await expect(
    page.getByRole("link", { name: "Open live site" }),
  ).toHaveAttribute("href", "https://arlequins.github.io/beat/");
});
