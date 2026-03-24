import { test, expect } from "@playwright/test";

test.describe("Layer Toggle", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for map and layers to load
    await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("text=레이어")).toBeVisible({ timeout: 10_000 });
  });

  test("should display layer categories", async ({ page }) => {
    // Layer tree should show categories
    await expect(page.locator("text=기본 지도")).toBeVisible();
  });

  test("should have layer checkboxes", async ({ page }) => {
    const checkboxes = page.locator('aside input[type="checkbox"]');
    await expect(checkboxes.first()).toBeVisible();
    const count = await checkboxes.count();
    expect(count).toBeGreaterThan(0);
  });

  test("should toggle a layer on and off", async ({ page }) => {
    const firstCheckbox = page.locator('aside input[type="checkbox"]').first();
    await expect(firstCheckbox).toBeVisible();

    const wasChecked = await firstCheckbox.isChecked();

    // Toggle
    await firstCheckbox.click();
    const afterClick = await firstCheckbox.isChecked();
    expect(afterClick).toBe(!wasChecked);

    // Toggle back
    await firstCheckbox.click();
    const afterSecondClick = await firstCheckbox.isChecked();
    expect(afterSecondClick).toBe(wasChecked);
  });
});
