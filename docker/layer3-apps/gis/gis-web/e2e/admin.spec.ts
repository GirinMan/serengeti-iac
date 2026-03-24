import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("관리자 기능", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("데이터 관리 패널이 존재한다 (admin 역할)", async ({ page }) => {
    const adminBtn = page.getByText("데이터 관리");
    await expect(adminBtn).toBeVisible({ timeout: 5000 });
  });

  test("데이터 관리 패널을 열고 닫을 수 있다", async ({ page }) => {
    const adminBtn = page.getByText("데이터 관리");
    await adminBtn.click();

    // 업로드/이력 섹션이 표시됨
    await expect(page.getByText("파일 업로드")).toBeVisible();
    await expect(page.locator("h4", { hasText: "수집 이력" })).toBeVisible();

    // 다시 클릭하면 닫힘
    await adminBtn.click();
    await expect(page.getByText("파일 업로드")).not.toBeVisible();
  });

  test("사용자 메뉴에 이름과 로그아웃 버튼이 표시된다", async ({ page }) => {
    await expect(page.getByText("관리자").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /로그아웃/ })).toBeVisible();
  });

  test("로그아웃 시 로그인 버튼이 다시 표시된다", async ({ page }) => {
    const logoutBtn = page.getByRole("button", { name: /로그아웃/ });
    await logoutBtn.click();
    // After logout, "로그인" button should reappear
    await expect(page.locator("button:has-text('로그인')")).toBeVisible({ timeout: 5000 });
  });
});
