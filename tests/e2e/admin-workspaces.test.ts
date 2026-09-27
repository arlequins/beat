import { expect, test } from "@playwright/test";

test("keeps the admin task list separate from article and Gourmet workspaces", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "beat-admin-session",
      JSON.stringify({
        accessExpiresAt: Date.now() + 60 * 60 * 1000,
        accessToken: "workspace-test-token",
        refreshExpiresAt: Date.now() + 2 * 60 * 60 * 1000,
        refreshToken: "workspace-test-refresh-token",
      }),
    );
  });

  await page.route("**/admin/content", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        records: [
          {
            category: "Engineering",
            origin: "repository",
            reviewStatus: "unreviewed",
            slug: "admin-workspace-test",
            status: "published",
            title: "Workspace test article",
          },
        ],
      }),
    }),
  );
  await page.route("**/api/gourmet/entries**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ entries: [], page: 1, total: 0 }),
    }),
  );
  await page.route("**/api/gourmet/quality", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ errorCount: 0, issues: [], warningCount: 0 }),
    }),
  );

  await page.goto("/admin/");
  await expect(
    page.getByRole("heading", { name: "어떤 작업을 할까요?" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /기사 작성·검토/ }),
  ).toContainText("기사 1개 · 검토 필요 1개");

  await page.getByRole("button", { name: /기사 작성·검토/ }).click();
  await expect(
    page.getByRole("heading", { name: "기사 작성·검토" }),
  ).toBeVisible();
  await expect(page.getByText("Gourmet 기록 관리")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.getByRole("button", { name: "작업 목록으로 돌아가기" }).click();
  await page.getByRole("button", { name: /Gourmet 기록 관리/ }).click();
  await expect(
    page.getByRole("heading", { name: "식사 기록 관리" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "기사 작성·검토" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
