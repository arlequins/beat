import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const locale of ["ko", "en", "ja"]) {
  test(`${locale} home opens content directly and keeps settings on demand`, async ({
    page,
  }) => {
    const prefix = locale === "en" ? "" : `/${locale}`;
    await page.goto(`${prefix}/`);
    const destinations = page.locator(".index-destinations");
    await expect(destinations.getByRole("link")).toHaveCount(3);
    for (const path of ["posts", "gourmet", "fiction"]) {
      await expect(
        destinations.locator(`a[href="${prefix}/${path}/"]`),
      ).toBeVisible();
    }
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
