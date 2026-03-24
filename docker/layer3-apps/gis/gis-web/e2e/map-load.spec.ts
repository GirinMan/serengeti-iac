import { test, expect } from "@playwright/test";

test.describe("Map Loading", () => {
  test("should load the application and render the map canvas", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 15_000 });
  });

  test("should display sidebar with title", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("aside")).toBeVisible();
    await expect(page.locator("text=GIS 지하시설물 관리")).toBeVisible();
  });

  test("should have navigation controls on the map", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".maplibregl-ctrl-zoom-in")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".maplibregl-ctrl-zoom-out")).toBeVisible();
    await expect(page.locator(".maplibregl-ctrl-scale")).toBeVisible();
  });

  test("should display measure tool buttons", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 15_000 });
    const distBtn = page.getByTitle("거리 측정 (ESC로 취소)");
    const areaBtn = page.getByTitle("면적 측정 (ESC로 취소)");
    await expect(distBtn).toBeVisible();
    await expect(areaBtn).toBeVisible();
  });

  test("should activate distance measure mode on click", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 15_000 });
    const distBtn = page.getByTitle("거리 측정 (ESC로 취소)");
    await distBtn.click();
    // Button should be active (blue background)
    await expect(distBtn).toHaveClass(/bg-blue-500/);
    // Instruction text should appear
    await expect(page.locator("text=지도를 클릭하세요")).toBeVisible();
    // ESC should cancel
    await page.keyboard.press("Escape");
    await expect(distBtn).not.toHaveClass(/bg-blue-500/);
  });

  test("should display map export button with menu", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 15_000 });
    const exportBtn = page.getByTitle("현재 지도를 PNG로 저장");
    await expect(exportBtn).toBeVisible();
    await expect(exportBtn).toContainText("내보내기");
    // Click to open menu
    await exportBtn.click();
    await expect(page.locator("text=지도만 저장")).toBeVisible();
    await expect(page.locator("text=인쇄 레이아웃")).toBeVisible();
  });

  test("should activate area measure mode and show instruction", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 15_000 });
    const areaBtn = page.getByTitle("면적 측정 (ESC로 취소)");
    await areaBtn.click();
    await expect(areaBtn).toHaveClass(/bg-blue-500/);
    await expect(page.locator("text=지도를 클릭하세요")).toBeVisible();
    await expect(page.locator("text=더블클릭: 완료")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(areaBtn).not.toHaveClass(/bg-blue-500/);
  });

  test("should show undo button during measurement", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 15_000 });
    const distBtn = page.getByTitle("거리 측정 (ESC로 취소)");
    await distBtn.click();
    // Click on map to add a point
    const canvas = page.locator("canvas.maplibregl-canvas");
    await canvas.click({ position: { x: 300, y: 300 } });
    // Undo button should appear
    await expect(page.locator("text=되돌리기")).toBeVisible();
    // ESC to cancel
    await page.keyboard.press("Escape");
  });

  test("should auto-select a region and load layers", async ({ page }) => {
    await page.goto("/");
    const regionSelect = page.locator("aside select");
    await expect(regionSelect).toBeVisible({ timeout: 10_000 });
    // Region should be auto-selected (first option)
    await expect(regionSelect).not.toHaveValue("");
  });
});
