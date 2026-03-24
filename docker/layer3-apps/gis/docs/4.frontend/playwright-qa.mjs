// Playwright QA script for GIS frontend - Loop 1
// Usage: npx playwright test --config=playwright-qa.config.mjs
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE_URL = "https://gis.giraffe.ai.kr";
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");
const RESULTS_FILE = path.join(SCREENSHOT_DIR, "qa-loop1-results.txt");

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const results = [];
function log(msg) {
  console.log(msg);
  results.push(msg);
}

async function screenshot(page, name, desc) {
  const fp = path.join(SCREENSHOT_DIR, `loop1-${name}.png`);
  await page.screenshot({ path: fp, fullPage: false });
  log(`[SCREENSHOT] ${name}: ${desc}`);
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  log(`=== GIS Frontend QA - Loop 1 (${new Date().toISOString()}) ===`);
  log(`Base URL: ${BASE_URL}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  try {
    // 1. Initial page load
    log("\n--- 1. Initial Load ---");
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
    await sleep(3000); // Wait for map tiles to load
    await screenshot(page, "01-initial-load", "Initial page load with map");

    // Check basic elements
    const title = await page.locator("h1").first().textContent();
    log(`Title: ${title}`);
    const canvas = await page.locator("canvas.maplibregl-canvas").count();
    log(`Map canvas found: ${canvas > 0 ? "YES" : "NO"}`);

    // 2. Sidebar elements
    log("\n--- 2. Sidebar ---");
    const regionSelector = await page.locator("select").first();
    if (await regionSelector.isVisible()) {
      const regionText = await regionSelector.inputValue();
      log(`Region selector visible, current value: ${regionText}`);
    }

    // Check layer tree
    const checkboxes = await page.locator('input[type="checkbox"]').count();
    log(`Layer checkboxes: ${checkboxes}`);
    await screenshot(page, "02-sidebar", "Sidebar with region selector and layers");

    // 3. Zoom to Pocheon center (포천시 중심)
    log("\n--- 3. Zoom to Pocheon ---");
    await page.evaluate(() => {
      const map = window.__maplibreMap || document.querySelector("canvas")?.closest(".maplibregl-map")?.__maplibreMap;
      // Try to access map via the store
    });
    // Use the "전체 보기" button
    const fitBtn = page.getByText("전체 보기");
    if (await fitBtn.isVisible()) {
      await fitBtn.click();
      await sleep(2000);
      log("Clicked '전체 보기' button");
    }
    await screenshot(page, "03-fit-region", "After fit region (전체 보기)");

    // 4. Test basemap switcher
    log("\n--- 4. Basemap Switcher ---");
    const satBtn = page.getByText("위성", { exact: true });
    if (await satBtn.isVisible()) {
      await satBtn.click();
      await sleep(3000);
      await screenshot(page, "04-satellite-map", "Satellite basemap");
      log("Switched to satellite basemap: OK");

      // Switch back to normal
      const osmBtn = page.getByText("일반", { exact: true });
      await osmBtn.click();
      await sleep(2000);
      log("Switched back to normal basemap: OK");
    } else {
      log("WARN: Satellite button not found");
    }

    // Switch to topo
    const topoBtn = page.getByText("지형", { exact: true });
    if (await topoBtn.isVisible()) {
      await topoBtn.click();
      await sleep(3000);
      await screenshot(page, "05-topo-map", "Topographic basemap");
      log("Switched to topo basemap: OK");

      // Switch back
      const osmBtn = page.getByText("일반", { exact: true });
      await osmBtn.click();
      await sleep(2000);
    }

    // 5. Layer toggle test
    log("\n--- 5. Layer Toggle ---");
    // Enable all layers
    const allCheckboxes = page.locator('input[type="checkbox"]');
    const cbCount = await allCheckboxes.count();
    for (let i = 0; i < cbCount; i++) {
      const cb = allCheckboxes.nth(i);
      if (!(await cb.isChecked())) {
        await cb.check();
        await sleep(500);
      }
    }
    await sleep(3000);
    await screenshot(page, "06-all-layers-on", "All layers enabled");
    log(`Enabled all ${cbCount} layers`);

    // 6. Zoom levels for pipe visibility
    log("\n--- 6. Pipe Visibility at Different Zooms ---");
    // Zoom in to see pipes better - use map API via JS
    await page.evaluate(() => {
      // Access MapLibre map instance
      const canvasEl = document.querySelector("canvas.maplibregl-canvas");
      if (canvasEl) {
        const mapEl = canvasEl.closest(".maplibregl-map");
        if (mapEl && mapEl._maplibre) {
          mapEl._maplibre.setZoom(15);
          mapEl._maplibre.setCenter([127.2, 37.9]); // Pocheon center
        }
      }
    });
    await sleep(3000);
    await screenshot(page, "07-zoom15-pipes", "Zoom 15 - pipe visibility");

    await page.evaluate(() => {
      const canvasEl = document.querySelector("canvas.maplibregl-canvas");
      if (canvasEl) {
        const mapEl = canvasEl.closest(".maplibregl-map");
        if (mapEl && mapEl._maplibre) {
          mapEl._maplibre.setZoom(16);
        }
      }
    });
    await sleep(3000);
    await screenshot(page, "08-zoom16-pipes", "Zoom 16 - pipe detail");

    await page.evaluate(() => {
      const canvasEl = document.querySelector("canvas.maplibregl-canvas");
      if (canvasEl) {
        const mapEl = canvasEl.closest(".maplibregl-map");
        if (mapEl && mapEl._maplibre) {
          mapEl._maplibre.setZoom(14);
        }
      }
    });
    await sleep(3000);
    await screenshot(page, "09-zoom14-overview", "Zoom 14 - overview");

    // 7. Search test
    log("\n--- 7. Search ---");
    const searchInput = page.locator('input[placeholder*="검색"], input[placeholder*="주소"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill("포천");
      await sleep(1500);
      await screenshot(page, "10-search-autocomplete", "Search autocomplete for '포천'");

      await searchInput.press("Enter");
      await sleep(2000);
      await screenshot(page, "11-search-results", "Search results for '포천'");
      log("Search test: OK");
    } else {
      log("WARN: Search input not found");
    }

    // 8. Measure tool test
    log("\n--- 8. Measure Tool ---");
    const distBtn = page.locator('button[title*="거리"]').first();
    if (await distBtn.count() > 0 && await distBtn.isVisible()) {
      await distBtn.click();
      await sleep(500);
      await screenshot(page, "12-measure-tool", "Measure tool activated");
      // Press Escape to cancel
      await page.keyboard.press("Escape");
      await sleep(500);
      log("Measure tool test: OK");
    } else {
      // Try finding by text
      const measureBtns = page.locator("button").filter({ hasText: /거리|면적/ });
      const mc = await measureBtns.count();
      log(`Measure buttons found: ${mc}`);
      if (mc > 0) {
        await measureBtns.first().click();
        await sleep(500);
        await screenshot(page, "12-measure-tool", "Measure tool activated");
        await page.keyboard.press("Escape");
      }
    }

    // 9. Map export button
    log("\n--- 9. Map Export ---");
    const exportBtn = page.locator("button").filter({ hasText: /내보내기|저장|Export/ });
    if (await exportBtn.count() > 0) {
      log("Export button found: YES");
    }

    // 10. Coordinate display
    log("\n--- 10. Coordinate Display ---");
    const coordDisplay = page.locator("text=/\\d+\\.\\d+.*\\d+\\.\\d+/");
    if (await coordDisplay.count() > 0) {
      log("Coordinate display visible: YES");
    } else {
      log("Coordinate display: may need mouse hover");
    }

    // 11. Login test
    log("\n--- 11. Login ---");
    const loginBtn = page.getByText("관리자 로그인");
    if (await loginBtn.isVisible()) {
      await loginBtn.click();
      await sleep(1000);
      await screenshot(page, "13-login-form", "Login form");
      log("Login form visible: OK");

      // Go back
      const backBtn = page.getByText("돌아가기").or(page.locator("button").filter({ hasText: /뒤로|Back/ }));
      if (await backBtn.count() > 0) {
        await backBtn.first().click();
        await sleep(1000);
      }
    }

    // 12. Final screenshot with all features visible
    log("\n--- 12. Final State ---");
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
    await sleep(4000);
    // Enable all layers again
    const finalCbs = page.locator('input[type="checkbox"]');
    const fCount = await finalCbs.count();
    for (let i = 0; i < fCount; i++) {
      const cb = finalCbs.nth(i);
      if (!(await cb.isChecked())) {
        await cb.check();
        await sleep(300);
      }
    }
    await sleep(3000);
    await screenshot(page, "14-final-all-features", "Final state with all features");

    log("\n=== QA Complete ===");
  } catch (err) {
    log(`ERROR: ${err.message}`);
    await screenshot(page, "99-error", `Error state: ${err.message}`).catch(() => {});
  } finally {
    await browser.close();
    fs.writeFileSync(RESULTS_FILE, results.join("\n") + "\n");
    console.log(`\nResults saved to ${RESULTS_FILE}`);
  }
})();
