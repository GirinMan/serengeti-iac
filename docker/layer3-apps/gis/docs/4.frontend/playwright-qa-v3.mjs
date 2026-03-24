// Playwright QA v3 - Uses window.__gis_map
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const BASE_URL = "https://gis.giraffe.ai.kr";
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");
const RESULTS_FILE = path.join(SCREENSHOT_DIR, "qa-loop1-v3-results.txt");

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const results = [];
function log(msg) { console.log(msg); results.push(msg); }

async function shot(page, name, desc) {
  const fp = path.join(SCREENSHOT_DIR, `loop1-v3-${name}.png`);
  await page.screenshot({ path: fp, fullPage: false });
  log(`[SHOT] ${name}: ${desc}`);
}

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
  log(`=== GIS QA v3 (${new Date().toISOString()}) ===`);

  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({
    viewport: { width: 1400, height: 900 },
    ignoreHTTPSErrors: true,
  })).newPage();

  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  try {
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
    // Wait for map to load (the __gis_map is set on map "load" event)
    await page.waitForFunction(() => window.__gis_map, { timeout: 15000 });
    await sleep(2000);

    log("Map loaded successfully");
    await shot(page, "01-loaded", "Initial load");

    // Get map state
    const info = await page.evaluate(() => {
      const m = window.__gis_map;
      return {
        zoom: m.getZoom().toFixed(1),
        center: [m.getCenter().lng.toFixed(3), m.getCenter().lat.toFixed(3)],
        layerCount: m.getStyle().layers.length,
        layers: m.getStyle().layers.map(l => ({
          id: l.id, type: l.type,
          vis: l.layout?.visibility ?? "visible",
          sl: l["source-layer"],
        })),
        sources: Object.keys(m.getStyle().sources),
      };
    });
    log(`Map: zoom=${info.zoom}, center=${info.center}, ${info.layerCount} layers`);
    log(`Sources: ${info.sources.join(", ")}`);
    for (const l of info.layers) {
      log(`  Layer: ${l.id} (${l.type}) vis=${l.vis} source-layer=${l.sl ?? "-"}`);
    }

    // Enable all checkboxes
    const cbs = page.locator('input[type="checkbox"]');
    const cbCount = await cbs.count();
    for (let i = 0; i < cbCount; i++) {
      if (!(await cbs.nth(i).isChecked())) await cbs.nth(i).check();
    }
    await sleep(500);
    log(`\nEnabled ${cbCount} layer checkboxes`);

    // Re-check layers after enabling
    const afterEnable = await page.evaluate(() => {
      const m = window.__gis_map;
      return m.getStyle().layers
        .filter(l => l.id.startsWith("lyr-"))
        .map(l => ({ id: l.id, vis: l.layout?.visibility ?? "visible", sl: l["source-layer"] }));
    });
    for (const l of afterEnable) {
      log(`  After enable: ${l.id} vis=${l.vis} sl=${l.sl}`);
    }

    // Fly to facility area (포천읍 도심)
    log("\n--- Fly to facility area ---");
    await page.evaluate(() => {
      window.__gis_map.jumpTo({ center: [127.2, 37.905], zoom: 15 });
    });
    await sleep(4000);
    await shot(page, "02-z15-facilities", "Zoom 15 - facility area");

    // Check rendered features
    const features = await page.evaluate(() => {
      const m = window.__gis_map;
      const allFeatures = m.queryRenderedFeatures();
      const bySource = {};
      for (const f of allFeatures) {
        const sl = f.sourceLayer || f.source;
        bySource[sl] = (bySource[sl] || 0) + 1;
      }
      return bySource;
    });
    log(`Rendered features by source: ${JSON.stringify(features)}`);

    // Zoom 16
    await page.evaluate(() => window.__gis_map.jumpTo({ zoom: 16 }));
    await sleep(4000);
    await shot(page, "03-z16", "Zoom 16");

    // Zoom 17
    await page.evaluate(() => window.__gis_map.jumpTo({ zoom: 17 }));
    await sleep(4000);
    await shot(page, "04-z17", "Zoom 17");

    // Satellite
    log("\n--- Satellite basemap ---");
    await page.getByText("위성", { exact: true }).click();
    await sleep(3000);
    await shot(page, "05-satellite", "Satellite at z17");

    // Topo
    await page.getByText("지형", { exact: true }).click();
    await sleep(3000);
    await shot(page, "06-topo", "Topo at z17");

    // Back to OSM
    await page.getByText("일반", { exact: true }).click();
    await sleep(2000);

    // Zoom 14 overview
    await page.evaluate(() => window.__gis_map.jumpTo({ center: [127.2, 37.905], zoom: 14 }));
    await sleep(4000);
    await shot(page, "07-z14-overview", "Zoom 14 overview");

    // Search
    log("\n--- Search ---");
    const searchInput = page.locator('input[placeholder*="검색"], input[placeholder*="주소"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill("포천읍");
      await sleep(2000);
      await shot(page, "08-search", "Search autocomplete");
      await searchInput.press("Enter");
      await sleep(2000);
      await shot(page, "09-search-results", "Full search results");
    }

    // Measure tool
    log("\n--- Measure tool ---");
    const measureBtn = page.locator("svg").locator("..").filter({ hasText: /거리/ }).first();
    if (await measureBtn.count() > 0) {
      await measureBtn.click();
      await sleep(500);
      await shot(page, "10-measure", "Measure tool");
      await page.keyboard.press("Escape");
    }

    // Login form
    log("\n--- Login ---");
    const loginBtn = page.getByText("관리자 로그인");
    if (await loginBtn.isVisible()) {
      await loginBtn.click();
      await sleep(1000);
      await shot(page, "11-login", "Login form");
    }

    // Console errors
    if (errors.length > 0) {
      log(`\nConsole errors (${errors.length}):`);
      for (const e of errors.slice(0, 20)) log(`  ${e.substring(0, 200)}`);
    }

    log("\n=== QA v3 Complete ===");
  } catch (err) {
    log(`ERROR: ${err.message}`);
    await shot(page, "99-error", err.message).catch(() => {});
  } finally {
    await browser.close();
    fs.writeFileSync(RESULTS_FILE, results.join("\n") + "\n");
  }
})();
