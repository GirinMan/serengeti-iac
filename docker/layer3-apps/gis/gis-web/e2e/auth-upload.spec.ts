import { test, expect } from "@playwright/test";
import { login, ensureLoggedOut } from "./helpers";

test.describe("Auth & Upload", () => {
  test("should show login button for unauthenticated users", async ({ page }) => {
    await ensureLoggedOut(page);
    await expect(page.locator("button:has-text('로그인')")).toBeVisible();
  });

  test("should navigate to login form and back", async ({ page }) => {
    await ensureLoggedOut(page);
    await page.locator("button:has-text('로그인')").click();
    // Login form should be visible
    await expect(page.getByLabel("사용자명")).toBeVisible({ timeout: 5_000 });
    // Fill credentials and login
    await page.getByLabel("사용자명").fill("admin");
    await page.getByLabel("비밀번호").fill("admin1234");
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 15_000 });
  });

  test("should login as admin and see admin panel", async ({ page }) => {
    await login(page);

    // Admin panel toggle should be visible after login
    const adminToggle = page.getByText("데이터 관리");
    await expect(adminToggle).toBeVisible({ timeout: 5_000 });

    // Click to expand admin panel
    await adminToggle.click();

    // Upload form elements should be visible
    await expect(page.getByText("파일 업로드")).toBeVisible();
    await expect(page.getByText("대상 테이블")).toBeVisible();
    await expect(page.locator("h4", { hasText: "수집 이력" })).toBeVisible();
  });

  test("should show upload form with target table selector", async ({ page }) => {
    await login(page);

    // Open admin panel
    await page.getByText("데이터 관리").click();
    await expect(page.getByText("파일 업로드")).toBeVisible();

    // Find the target table select inside admin panel
    const uploadForm = page.locator("form");
    const tableSelect = uploadForm.locator("select").first();
    await expect(tableSelect).toBeVisible();
    const options = await tableSelect.locator("option").allTextContents();
    expect(options).toContain("지번 (parcels)");
    expect(options).toContain("건물 (buildings)");
    expect(options).toContain("시설물 (facilities)");
  });

  test("should show facility type selector when facilities is selected", async ({ page }) => {
    await login(page);

    // Open admin panel
    await page.getByText("데이터 관리").click();
    await expect(page.getByText("파일 업로드")).toBeVisible();

    // Select facilities in the upload form
    const uploadForm = page.locator("form");
    const tableSelect = uploadForm.locator("select").first();
    await tableSelect.selectOption("facilities");

    // Facility type selector should appear
    await expect(page.getByText("시설물 유형")).toBeVisible();
    const typeSelect = uploadForm.locator("select").nth(1);
    const typeOptions = await typeSelect.locator("option").allTextContents();
    expect(typeOptions).toContain("하수맨홀");
    expect(typeOptions).toContain("하수관로");
  });

  test("should show user menu after login", async ({ page }) => {
    await login(page);
    await expect(page.getByText("관리자").first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: "로그아웃" })).toBeVisible();
  });
});
