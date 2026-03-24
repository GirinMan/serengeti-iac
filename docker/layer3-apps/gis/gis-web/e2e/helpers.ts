import { expect, type Page } from "@playwright/test";

/**
 * Session-aware login as admin.
 * - If already logged in (admin user menu visible): skip
 * - If guest (map visible with "로그인" button): click login, fill form, submit
 */
export async function login(page: Page) {
  await page.goto("/");
  await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 15_000 });

  // Race: already logged in (user menu with role badge) vs guest ("로그인" button)
  const logoutBtn = page.getByRole("button", { name: "로그아웃" });
  const loginBtn = page.locator("button:has-text('로그인')").first();

  const state = await Promise.race([
    logoutBtn.waitFor({ state: "visible", timeout: 5_000 }).then(() => "loggedIn" as const),
    loginBtn.waitFor({ state: "visible", timeout: 5_000 }).then(() => "guest" as const),
  ]).catch(() => "guest" as const);

  if (state === "guest") {
    await loginBtn.click();
    await page.getByLabel("사용자명").fill("admin");
    await page.getByLabel("비밀번호").fill("admin1234");
    await page.getByRole("button", { name: "로그인" }).click();
    // Wait for map to reappear after login
    await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 15_000 });
    // Wait for user info to load (display name is "관리자")
    await expect(page.getByRole("button", { name: "로그아웃" })).toBeVisible({ timeout: 10_000 });
  }
}

/**
 * Ensure logged out state: clear session, reload page.
 * After this, user is a guest with map visible and "로그인" button.
 */
export async function ensureLoggedOut(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.context().clearCookies();
  await page.reload();
  await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 15_000 });
}
