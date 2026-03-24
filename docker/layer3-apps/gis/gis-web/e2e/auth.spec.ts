import { test, expect } from "@playwright/test";
import { ensureLoggedOut, login } from "./helpers";

test.describe("인증", () => {
  test("게스트 상태에서 로그인 버튼이 표시된다", async ({ page }) => {
    await ensureLoggedOut(page);
    await expect(page.locator("button:has-text('로그인')")).toBeVisible();
  });

  test("로그인 버튼 클릭 시 로그인 폼이 표시된다", async ({ page }) => {
    await ensureLoggedOut(page);
    await page.locator("button:has-text('로그인')").click();
    await expect(page.getByLabel("사용자명")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByLabel("비밀번호")).toBeVisible();
    await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();
  });

  test("잘못된 자격증명으로 로그인 실패", async ({ page }) => {
    await ensureLoggedOut(page);
    await page.locator("button:has-text('로그인')").click();
    await page.getByLabel("사용자명").fill("wrong");
    await page.getByLabel("비밀번호").fill("wrong");
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page.locator(".text-red-600")).toBeVisible();
  });

  test("올바른 자격증명으로 로그인 성공", async ({ page }) => {
    await ensureLoggedOut(page);
    await page.locator("button:has-text('로그인')").click();
    await page.getByLabel("사용자명").fill("admin");
    await page.getByLabel("비밀번호").fill("admin1234");
    await page.getByRole("button", { name: "로그인" }).click();

    // 로그인 성공 후 지도 페이지로 전환
    await expect(page.locator("canvas")).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: "로그아웃" })).toBeVisible({ timeout: 10000 });
  });
});
