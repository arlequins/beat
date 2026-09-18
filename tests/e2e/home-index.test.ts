import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const locale of ["ko", "en", "ja"]) {
  test(`${locale} home opens content directly and keeps settings on demand`, async ({
    page,
  }) => {
    const prefix = locale === "en" ? "" : `/${locale}`;
    await page.goto(`${prefix}/`);
    await expect(page.locator(".index-role")).toBeVisible();
    await expect(page.locator(".index-featured")).toBeVisible();
    await expect(page.locator(".index-featured h2 a")).toHaveAttribute(
      "href",
      `${prefix}/work/beat-template/`,
    );
    const destinations = page.locator(".index-destinations");
    await expect(destinations.getByRole("link")).toHaveCount(3);
    for (const path of ["posts", "gourmet", "fiction"]) {
      await expect(
        destinations.locator(`a[href="${prefix}/${path}/"]`),
      ).toBeVisible();
    }
    await expect(page.locator(".home-object")).toHaveCount(0);
    await expect(page.locator(".index-fiction")).toHaveAttribute(
      "href",
      `${prefix}/fiction/`,
    );
    await page.locator(".index-fiction").click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/fiction/$`));
    await expect(page.locator(".novel-episode").first()).toBeVisible();
    await page.goto(`${prefix}/`);
    const menu = page.locator("#site-menu");
    await expect(menu).toBeHidden();
    await page.locator(".site-menu-trigger").click();
    await expect(menu.getByLabel("Language")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await page.locator("#work summary").click();
    await expect(page.locator("#work ul a")).toHaveCount(3);
    await expect(page.locator("#work ul a").first()).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      audit.violations.filter(
        ({ impact }) => impact === "serious" || impact === "critical",
      ),
    ).toEqual([]);
  });
}

test("home and featured work remain readable at narrow mobile widths", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await expect(page.locator(".index-featured")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator(".index-notes a > span")
      .first()
      .evaluate((element) => getComputedStyle(element).whiteSpace),
  ).toBe("normal");
});

test("home menu opens after a touch long press", async ({ page }) => {
  await page.goto("/ko/");
  const menu = page.locator("#site-menu");
  const trigger = page.locator(".site-menu-trigger");
  await expect(menu).toBeHidden();

  await trigger.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    element.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
      }),
    );
  });
  await page.waitForTimeout(700);
  await expect(menu).toBeVisible();

  await trigger.evaluate((element) => {
    element.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
      }),
    );
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await expect(menu).toBeVisible();
});
