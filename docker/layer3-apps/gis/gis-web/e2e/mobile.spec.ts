import { test, expect } from "@playwright/test";

test.describe("Mobile Responsive Layout", () => {
  test("should hide sidebar by default on mobile", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 15_000 });
    // Sidebar should be off-screen (translated)
    const aside = page.locator("aside");
    await expect(aside).toHaveClass(/-translate-x-full/);
  });

  test("should show hamburger menu button on mobile", async ({ page }) => {
    await page.goto("/");
    const hamburger = page.getByLabel("메뉴 토글");
    await expect(hamburger).toBeVisible();
  });

  test("should open sidebar when hamburger is tapped", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 15_000 });

    const hamburger = page.getByLabel("메뉴 토글");
    await hamburger.click();

    // Sidebar should be visible
    const aside = page.locator("aside");
    await expect(aside).toHaveClass(/translate-x-0/);
    await expect(page.locator("text=GIS 지하시설물 관리")).toBeVisible();

    // Backdrop should be visible
    await expect(page.locator(".bg-black\\/30")).toBeVisible();
  });

  test("should close sidebar when backdrop is tapped", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 15_000 });

    // Open sidebar
    await page.getByLabel("메뉴 토글").click();
    await expect(page.locator("aside")).toHaveClass(/translate-x-0/);

    // Tap backdrop area (right of sidebar w-60=240px, Pixel 7 viewport=412px)
    await page.locator(".bg-black\\/30").click({ position: { x: 350, y: 400 } });
    await expect(page.locator("aside")).toHaveClass(/-translate-x-full/);
  });

  test("should display map controls below hamburger area", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 15_000 });

    // Controls should be visible and not hidden behind sidebar
    const fitBtn = page.getByTitle("전체 지역 보기");
    await expect(fitBtn).toBeVisible();

    const distBtn = page.getByTitle("거리 측정 (ESC로 취소)");
    await expect(distBtn).toBeVisible();
  });

  test("should hide coordinate display on mobile", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 15_000 });
    // CoordinateDisplay should be hidden (md:flex but hidden on mobile)
    const coordDisplay = page.locator(".font-mono").filter({ hasText: /Z\d/ });
    await expect(coordDisplay).toBeHidden();
  });

  test("should render map canvas full-width on mobile", async ({ page }) => {
    await page.goto("/");
    const canvas = page.locator("canvas.maplibregl-canvas");
    await expect(canvas).toBeVisible({ timeout: 15_000 });

    // Map should take full viewport width (sidebar is hidden)
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    // iPhone 14 viewport is 390px wide
    expect(box!.width).toBeGreaterThan(350);
  });

  test("should have touch-friendly button sizes on mobile", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 15_000 });

    // Measure buttons should have larger touch targets
    const distBtn = page.getByTitle("거리 측정 (ESC로 취소)");
    const box = await distBtn.boundingBox();
    expect(box).toBeTruthy();
    // Should be at least 36px tall (larger than desktop 28px)
    expect(box!.height).toBeGreaterThanOrEqual(36);
  });

  test("should close sidebar after search result select on mobile", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 15_000 });

    // Open sidebar
    await page.getByLabel("메뉴 토글").click();
    await expect(page.locator("aside")).toHaveClass(/translate-x-0/);

    // Type search query
    const input = page.locator("input[placeholder='주소 검색...']");
    await input.fill("포천");
    await input.press("Enter");

    // Wait for search results
    const resultCount = page.locator("text=/\\d+건/");
    await expect(resultCount).toBeVisible({ timeout: 10_000 });

    // Click first result
    const firstResult = page.locator("aside button").filter({ hasText: /포천/ }).first();
    await firstResult.click();

    // Sidebar should auto-close on mobile after selecting a result
    await expect(page.locator("aside")).toHaveClass(/-translate-x-full/, { timeout: 5_000 });
  });

  test("should use narrower sidebar on mobile", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 15_000 });

    // Open sidebar
    await page.getByLabel("메뉴 토글").click();
    await expect(page.locator("aside")).toHaveClass(/translate-x-0/);

    // Sidebar should be narrower on mobile (w-60 = 240px)
    const aside = page.locator("aside");
    const box = await aside.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeLessThanOrEqual(250);
  });
});
