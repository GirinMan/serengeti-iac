// Playwright QA v2 - Better map control via wheel zoom and drag
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const BASE_URL = "https://gis.giraffe.ai.kr";
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");
const RESULTS_FILE = path.join(SCREENSHOT_DIR, "qa-loop1-v2-results.txt");

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const results = [];
function log(msg) { console.log(msg); results.push(msg); }

async function screenshot(page, name, desc) {
  const fp = path.join(SCREENSHOT_DIR, `loop1-v2-${name}.png`);
  await page.screenshot({ path: fp, fullPage: false });
  log(`[SCREENSHOT] ${name}: ${desc}`);
}

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// Helper to programmatically control the map via Zustand store
async function mapCommand(page, jsCode) {
  return page.evaluate((code) => {
    // Access Zustand store from window - expose it from MapView
    return new Function("return " + code)();
  }, jsCode);
}

(async () => {
  log(`=== GIS Frontend QA v2 - Loop 1 (${new Date().toISOString()}) ===`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  // Collect console messages for debugging
  const consoleMsgs = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleMsgs.push(`[${msg.type()}] ${msg.text()}`);
  });

  try {
    // 1. Load page and inject map accessor
    log("\n--- 1. Initial Load ---");
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
    await sleep(3000);

    // Expose map on window for testing
    await page.evaluate(() => {
      // Find MapLibre canvas and get map from its parent
      const container = document.querySelector(".maplibregl-map");
      if (container) {
        // MapLibre stores the map instance on the container
        const entries = Object.entries(container);
        for (const [key, val] of entries) {
          if (val && typeof val === "object" && typeof val.getZoom === "function") {
            window.__testMap = val;
            break;
          }
        }
        // Alternative: try _maplibre property
        if (!window.__testMap && container._maplibre) {
          window.__testMap = container._maplibre;
        }
      }
    });

    // Try another approach: access via MapLibre internal
    const hasMap = await page.evaluate(() => {
      if (window.__testMap) return true;
      // MapLibre GL JS stores map on the container element
      const maps = document.querySelectorAll(".maplibregl-map");
      for (const m of maps) {
        // Check various internal properties
        for (const key of Object.getOwnPropertyNames(m)) {
          if (key.startsWith("_") || key.startsWith("__")) {
            const val = m[key];
            if (val && typeof val.getZoom === "function") {
              window.__testMap = val;
              return true;
            }
          }
        }
      }
      return false;
    });

    log(`Map instance accessible: ${hasMap}`);
    await screenshot(page, "01-initial", "Initial page load");

    // 2. Get current zoom and center
    const mapInfo = await page.evaluate(() => {
      if (!window.__testMap) return null;
      const m = window.__testMap;
      return { zoom: m.getZoom(), center: m.getCenter(), layers: m.getStyle()?.layers?.length };
    });
    log(`Map info: ${JSON.stringify(mapInfo)}`);

    // 3. Try to fly to facility area and zoom in
    log("\n--- 2. Fly to Facility Area ---");
    await page.evaluate(() => {
      if (!window.__testMap) return;
      window.__testMap.flyTo({
        center: [127.2, 37.905],
        zoom: 15,
        duration: 0,
      });
    });
    await sleep(4000);
    await screenshot(page, "02-zoom15", "Zoom 15 - Pocheon center");

    const z15Info = await page.evaluate(() => {
      if (!window.__testMap) return null;
      const m = window.__testMap;
      return {
        zoom: m.getZoom().toFixed(1),
        center: [m.getCenter().lng.toFixed(4), m.getCenter().lat.toFixed(4)],
        layers: m.getStyle()?.layers?.map((l) => `${l.id}:${l.visibility ?? l.layout?.visibility ?? "?"}`),
      };
    });
    log(`After flyTo: ${JSON.stringify(z15Info)}`);

    // 4. Check which vector layers are visible
    log("\n--- 3. Layer Visibility Check ---");
    const layerStatus = await page.evaluate(() => {
      if (!window.__testMap) return [];
      const m = window.__testMap;
      const style = m.getStyle();
      if (!style) return [];
      return style.layers
        .filter((l) => l.id.startsWith("lyr-") || l.id === "osm-tiles")
        .map((l) => ({
          id: l.id,
          type: l.type,
          visibility: l.layout?.visibility ?? "visible",
          source: l.source,
          sourceLayer: l["source-layer"],
        }));
    });
    log(`Vector layers: ${JSON.stringify(layerStatus, null, 2)}`);

    // 5. Check all sources
    const sourceStatus = await page.evaluate(() => {
      if (!window.__testMap) return [];
      const m = window.__testMap;
      const style = m.getStyle();
      if (!style || !style.sources) return [];
      return Object.entries(style.sources).map(([id, s]) => ({
        id,
        type: s.type,
        tiles: s.tiles?.slice(0, 1),
      }));
    });
    log(`Sources: ${JSON.stringify(sourceStatus, null, 2)}`);

    // 6. Enable all checkboxes
    log("\n--- 4. Enable All Layers ---");
    const cbs = page.locator('input[type="checkbox"]');
    const cbCount = await cbs.count();
    for (let i = 0; i < cbCount; i++) {
      const cb = cbs.nth(i);
      if (!(await cb.isChecked())) {
        await cb.check();
        await sleep(300);
      }
    }
    await sleep(2000);

    // Re-check layer visibility after enabling
    const afterEnableStatus = await page.evaluate(() => {
      if (!window.__testMap) return [];
      const m = window.__testMap;
      return m.getStyle().layers
        .filter((l) => l.id.startsWith("lyr-") || l.id.startsWith("src-"))
        .map((l) => ({
          id: l.id,
          visibility: l.layout?.visibility ?? "visible",
        }));
    });
    log(`After enable: ${JSON.stringify(afterEnableStatus)}`);

    await screenshot(page, "03-all-enabled-z15", "All layers enabled at z15");

    // 7. Zoom to 16
    await page.evaluate(() => {
      if (!window.__testMap) return;
      window.__testMap.flyTo({ center: [127.2, 37.905], zoom: 16, duration: 0 });
    });
    await sleep(4000);
    await screenshot(page, "04-zoom16", "Zoom 16 with all layers");

    // 8. Zoom to 17
    await page.evaluate(() => {
      if (!window.__testMap) return;
      window.__testMap.flyTo({ center: [127.2, 37.905], zoom: 17, duration: 0 });
    });
    await sleep(4000);
    await screenshot(page, "05-zoom17", "Zoom 17 with all layers");

    // 9. Satellite mode at zoom 16
    log("\n--- 5. Satellite + Facilities ---");
    const satBtn = page.getByText("위성", { exact: true });
    if (await satBtn.isVisible()) {
      await satBtn.click();
      await sleep(2000);
    }
    await page.evaluate(() => {
      if (!window.__testMap) return;
      window.__testMap.flyTo({ center: [127.2, 37.905], zoom: 16, duration: 0 });
    });
    await sleep(4000);
    await screenshot(page, "06-satellite-z16", "Satellite basemap at z16 with facilities");

    // Switch back to OSM
    const osmBtn = page.getByText("일반", { exact: true });
    if (await osmBtn.isVisible()) {
      await osmBtn.click();
      await sleep(2000);
    }

    // 10. Search test
    log("\n--- 6. Search ---");
    const searchInput = page.locator("input").filter({ hasText: "" }).first();
    const allInputs = page.locator("input");
    const inputCount = await allInputs.count();
    for (let i = 0; i < inputCount; i++) {
      const inp = allInputs.nth(i);
      const ph = await inp.getAttribute("placeholder");
      if (ph && (ph.includes("검색") || ph.includes("주소"))) {
        await inp.fill("포천읍");
        await sleep(2000);
        await screenshot(page, "07-search", "Search for '포천읍'");
        await inp.press("Enter");
        await sleep(2000);
        await screenshot(page, "08-search-results", "Search results");
        break;
      }
    }

    // 11. Console errors
    if (consoleMsgs.length > 0) {
      log("\n--- Console Errors ---");
      for (const msg of consoleMsgs.slice(0, 10)) log(msg);
    }

    log("\n=== QA v2 Complete ===");
  } catch (err) {
    log(`ERROR: ${err.message}`);
    await screenshot(page, "99-error", `Error: ${err.message}`).catch(() => {});
  } finally {
    await browser.close();
    fs.writeFileSync(RESULTS_FILE, results.join("\n") + "\n");
    console.log(`\nResults saved to ${RESULTS_FILE}`);
  }
})();
