import { expect, test } from "@playwright/test";

test("confirms bounded public post context before handing off to Beat", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "beat-admin-session",
      JSON.stringify({
        accessExpiresAt: Date.now() + 60_000,
        accessToken: "e2e-access-token",
        refreshExpiresAt: Date.now() + 60_000,
        refreshToken: "e2e-refresh-token",
      }),
    );
  });
  await page.goto("/en/posts/weekly-it-brief-2026-08-17/");

  await page.getByRole("button", { name: "Ask Beat about this post" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Review what will be sent to Beat",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Only the public post details below");

  const confirmation = dialog.getByRole("link", {
    name: "Confirm and open Beat",
  });
  const href = new URL((await confirmation.getAttribute("href")) ?? "");
  expect(href.origin).toBe("https://arlequins.github.io");
  expect(href.pathname).toBe("/beat-agent/");
  expect(href.searchParams.get("handoff")).toBe("beat-blog");
  expect(href.searchParams.get("title")?.length).toBeGreaterThan(0);
  expect(href.searchParams.get("title")?.length).toBeLessThanOrEqual(200);
  expect(href.searchParams.get("excerpt")?.length).toBeLessThanOrEqual(1_500);
  expect(href.searchParams.get("url")).toContain(
    "/en/posts/weekly-it-brief-2026-08-17/",
  );

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
