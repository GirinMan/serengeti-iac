import { test, expect } from "@playwright/test";
import { login } from "./helpers";

// More specific locator for search results panel (avoid matching Legend panel)
const searchResultsSelector = ".top-full.shadow-lg";

test.describe("Address Search", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should show search input", async ({ page }) => {
    const searchInput = page.locator('input[placeholder="주소 검색..."]');
    await expect(searchInput).toBeVisible();
  });

  test("should show autocomplete results when typing", async ({ page }) => {
    const searchInput = page.locator('input[placeholder="주소 검색..."]');
    await searchInput.fill("포천");

    // Wait for debounce (300ms) + API response
    const resultsPanel = page.locator(searchResultsSelector);
    await expect(resultsPanel).toBeVisible({ timeout: 10_000 });
  });

  test("should perform full search on Enter", async ({ page }) => {
    const searchInput = page.locator('input[placeholder="주소 검색..."]');
    await searchInput.fill("포천시 소흘읍");
    await searchInput.press("Enter");

    const resultsPanel = page.locator(searchResultsSelector);
    await expect(resultsPanel).toBeVisible({ timeout: 10_000 });
  });

  test("should perform search on button click", async ({ page }) => {
    const searchInput = page.locator('input[placeholder="주소 검색..."]');
    await searchInput.fill("포천");

    const searchButton = page.locator("button", { hasText: "검색" });
    await searchButton.click();

    const resultsPanel = page.locator(searchResultsSelector);
    await expect(resultsPanel).toBeVisible({ timeout: 10_000 });
  });

  test("should show highlight marker when selecting search result", async ({ page }) => {
    const searchInput = page.locator('input[placeholder="주소 검색..."]');
    await searchInput.fill("포천");
    await searchInput.press("Enter");

    const resultsPanel = page.locator(searchResultsSelector);
    await expect(resultsPanel).toBeVisible({ timeout: 10_000 });

    // Click first result
    const firstResult = resultsPanel.locator("button.block").first();
    await firstResult.click();

    // Highlight marker should appear on map
    const marker = page.locator(".highlight-marker");
    await expect(marker).toBeVisible({ timeout: 3_000 });

    const dot = page.locator(".highlight-marker-dot");
    await expect(dot).toBeVisible();

    const label = page.locator(".highlight-marker-label");
    await expect(label).toBeVisible();
    await expect(label).not.toBeEmpty();
  });

  test("should remove highlight marker on map click", async ({ page }) => {
    const searchInput = page.locator('input[placeholder="주소 검색..."]');
    await searchInput.fill("포천");
    await searchInput.press("Enter");

    const resultsPanel = page.locator(searchResultsSelector);
    await expect(resultsPanel).toBeVisible({ timeout: 10_000 });

    const firstResult = resultsPanel.locator("button.block").first();
    await firstResult.click();

    const marker = page.locator(".highlight-marker");
    await expect(marker).toBeVisible({ timeout: 3_000 });

    // Click on the map canvas to dismiss marker
    const canvas = page.locator("canvas.maplibregl-canvas");
    await canvas.click({ position: { x: 400, y: 300 } });

    await expect(marker).not.toBeVisible({ timeout: 3_000 });
  });

  test("should close results on Escape", async ({ page }) => {
    const searchInput = page.locator('input[placeholder="주소 검색..."]');
    await searchInput.fill("포천");
    await searchInput.press("Enter");

    const resultsPanel = page.locator(searchResultsSelector);
    await expect(resultsPanel).toBeVisible({ timeout: 10_000 });

    await searchInput.press("Escape");
    await expect(resultsPanel).not.toBeVisible({ timeout: 3_000 });
  });
});
