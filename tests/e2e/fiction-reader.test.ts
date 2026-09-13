import { expect, test } from "@playwright/test";

test.use({ hasTouch: true });

test("book controls stay visible, turn pages, and apply reading theme", async ({
  page,
}) => {
  await page.goto("/ko/fiction/the-last-window/");
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
    "rgb(32, 32, 32)",
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

test("library omits free labels", async ({ page }) => {
  await page.goto("/ko/fiction/");
  await expect(page.getByText("무료", { exact: true })).toHaveCount(0);
});

test("book repaginates when body content arrives after initial layout", async ({
  page,
}) => {
  await page.goto("/ko/fiction/the-last-window/");
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
