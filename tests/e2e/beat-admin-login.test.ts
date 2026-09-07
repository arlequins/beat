import { expect, test } from "@playwright/test";

test("resolves the admin session before showing a visible Google login error", async ({
  page,
}) => {
  await page.route(
    "http://localhost:5557/.well-known/openid-configuration",
    async (route) => {
      await route.fulfill({
        body: JSON.stringify({ error: "temporary test failure" }),
        contentType: "application/json",
        status: 500,
      });
    },
  );

  await page.goto("/admin/");
  const login = page.getByRole("button", { name: "Google 계정으로 계속" });
  await expect(login).toBeVisible();
  await login.click();

  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Google 로그인 설정을 불러올 수 없습니다.");
  await expect(alert).toHaveClass(/text-red-700/);
});
