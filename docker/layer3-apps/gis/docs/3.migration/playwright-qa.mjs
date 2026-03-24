/**
 * Playwright QA Script for GIS Utility Map - Loop 5
 * Browser verification of facility rendering, popups, layer toggling
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const BASE_URL = 'http://localhost:18080';
const SS = '/home/girinman/workspace/gis-utility-map/docs/migration/screenshots';
const results = [];

function log(msg) {
  console.log(`[QA] ${msg}`);
  results.push(msg);
}

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function getMapInstance(page) {
  // Access MapLibre map through Zustand store internals or canvas
  return page.evaluate(() => {
    // Try to get map from Zustand store
    // The store is attached to the React tree; we can find it via __REACT_FIBER
    const canvases = document.querySelectorAll('canvas');
    for (const canvas of canvases) {
      // MapLibre attaches the map instance to the canvas container's parent
      let el = canvas.parentElement;
      while (el) {
        const keys = Object.keys(el);
        for (const key of keys) {
          if (key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance')) {
            let fiber = el[key];
            let depth = 0;
            while (fiber && depth < 50) {
              if (fiber.memoizedState) {
                let hook = fiber.memoizedState;
                while (hook) {
                  if (hook.queue?.lastRenderedState?.map?.getZoom) {
                    window.__gis_map = hook.queue.lastRenderedState.map;
                    return true;
                  }
                  hook = hook.next;
                }
              }
              fiber = fiber.return;
              depth++;
            }
          }
        }
        el = el.parentElement;
      }
    }
    // Fallback: search for MapLibre instance on canvas parent
    for (const canvas of canvases) {
      const parent = canvas.parentElement;
      if (parent?.classList?.contains('maplibregl-canvas-container') ||
          parent?.parentElement?.classList?.contains('maplibregl-map')) {
        const mapContainer = parent?.parentElement;
        if (mapContainer?._maplibre) {
          window.__gis_map = mapContainer._maplibre;
          return true;
        }
        // Try React internal state lookup via container div
        const containerDiv = mapContainer?.parentElement;
        if (containerDiv) {
          const fiberKey = Object.keys(containerDiv).find(k => k.startsWith('__reactFiber'));
          if (fiberKey) {
            let fiber = containerDiv[fiberKey];
            let depth = 0;
            while (fiber && depth < 100) {
              // Check memoizedProps for map ref
              if (fiber.memoizedState?.memoizedState?.current?.getZoom) {
                window.__gis_map = fiber.memoizedState.memoizedState.current;
                return true;
              }
              fiber = fiber.return;
              depth++;
            }
          }
        }
      }
    }
    return false;
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  const tileResponses = [];
  page.on('response', resp => {
    const url = resp.url();
    if (url.includes('/tiles/') || url.includes('facility')) {
      tileResponses.push({ url, status: resp.status() });
    }
  });

  try {
    // ── Test 1: Initial load ──
    log('=== Test 1: Page Load ===');
    const resp = await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    log(`Status: ${resp.status()}`);

    // Wait for map to fully initialize
    await page.waitForSelector('canvas.maplibregl-canvas', { timeout: 10000 });
    await delay(3000);
    await page.screenshot({ path: `${SS}/01-initial-load.png` });
    log('Map canvas found, initial screenshot saved');

    // ── Test 2: Access map and check zoom/center ──
    log('\n=== Test 2: Map Instance & Navigation ===');

    // Inject helper to expose map via maplibregl internal
    const mapInfo = await page.evaluate(() => {
      // MapLibre stores the map instance on the container div
      const mapDiv = document.querySelector('.maplibregl-map');
      if (mapDiv && mapDiv._maplibre_map) {
        window.__gis_map = mapDiv._maplibre_map;
      }
      // Alternative: traverse canvas hierarchy
      const canvas = document.querySelector('canvas.maplibregl-canvas');
      if (canvas) {
        const container = canvas.closest('.maplibregl-map');
        if (container) {
          // MapLibre GL JS stores map on the container element
          const props = Object.getOwnPropertyNames(container);
          for (const p of props) {
            try {
              const val = container[p];
              if (val && typeof val.getZoom === 'function') {
                window.__gis_map = val;
                break;
              }
            } catch (e) {}
          }
        }
      }
      if (window.__gis_map) {
        return {
          found: true,
          zoom: window.__gis_map.getZoom(),
          center: window.__gis_map.getCenter(),
        };
      }
      return { found: false };
    });
    log(`Map instance found: ${mapInfo.found}`);
    if (mapInfo.found) {
      log(`Current zoom: ${mapInfo.zoom?.toFixed(2)}, center: [${mapInfo.center?.lng?.toFixed(4)}, ${mapInfo.center?.lat?.toFixed(4)}]`);
    }

    // If map not found via property, try using wheel zoom to navigate
    if (!mapInfo.found) {
      log('Trying alternative map access...');
      const found = await getMapInstance(page);
      log(`Alternative access: ${found}`);
    }

    // Zoom to z15 via programmatic call or wheel events
    log('Zooming to z15 at Pocheon center...');
    const zoomed = await page.evaluate(() => {
      if (window.__gis_map) {
        window.__gis_map.jumpTo({ center: [127.2, 37.9], zoom: 15 });
        return true;
      }
      return false;
    });

    if (!zoomed) {
      // Fallback: use mouse wheel to zoom in
      log('Using mouse wheel to zoom in...');
      const mapBox = await page.locator('canvas.maplibregl-canvas').boundingBox();
      if (mapBox) {
        const cx = mapBox.x + mapBox.width / 2;
        const cy = mapBox.y + mapBox.height / 2;
        // Zoom in with Ctrl+scroll or just scroll
        for (let i = 0; i < 15; i++) {
          await page.mouse.wheel(0, -300);
          await delay(200);
        }
      }
    }

    await delay(5000); // Wait for tiles at z15
    await page.screenshot({ path: `${SS}/02-zoomed-z15.png` });
    log('Screenshot after zoom saved');

    // Check current zoom after navigation
    const afterZoom = await page.evaluate(() => {
      if (window.__gis_map) {
        return { zoom: window.__gis_map.getZoom(), center: window.__gis_map.getCenter() };
      }
      return null;
    });
    if (afterZoom) {
      log(`After zoom - zoom: ${afterZoom.zoom?.toFixed(2)}, center: [${afterZoom.center?.lng?.toFixed(4)}, ${afterZoom.center?.lat?.toFixed(4)}]`);
    }

    // ── Test 3: Layer visibility ──
    log('\n=== Test 3: Layer Tree ===');
    const layerInfo = await page.evaluate(() => {
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      return Array.from(checkboxes).map(cb => ({
        checked: cb.checked,
        label: cb.closest('label')?.textContent?.trim() || cb.parentElement?.textContent?.trim() || 'unknown',
      }));
    });
    for (const l of layerInfo) {
      log(`  Layer: "${l.label}" - checked: ${l.checked}`);
    }

    // ── Test 4: Tile endpoint checks ──
    log('\n=== Test 4: Direct Tile Checks ===');
    const tileCheck = await page.evaluate(async () => {
      const endpoints = [
        '/tiles/gis.facility_nodes/15/27954/12645.pbf',
        '/tiles/gis.facility_pipes/15/27954/12645.pbf',
        '/tiles/gis.parcels/15/27954/12645.pbf',
        '/tiles/gis.buildings/15/27954/12645.pbf',
      ];
      const results = [];
      for (const ep of endpoints) {
        try {
          const res = await fetch(ep);
          const buf = await res.arrayBuffer();
          results.push({ ep, status: res.status, bytes: buf.byteLength });
        } catch (e) {
          results.push({ ep, error: e.message });
        }
      }
      return results;
    });
    for (const t of tileCheck) {
      log(`  ${t.ep}: ${t.status} (${t.bytes} bytes)`);
    }

    // ── Test 5: Query rendered features ──
    log('\n=== Test 5: Rendered Features ===');
    const features = await page.evaluate(() => {
      if (!window.__gis_map) return { error: 'no map instance' };
      const map = window.__gis_map;
      const all = map.queryRenderedFeatures();
      const byLayer = {};
      const bySrc = {};
      for (const f of all) {
        const lid = f.layer?.id || 'unknown';
        const src = f.source || 'unknown';
        byLayer[lid] = (byLayer[lid] || 0) + 1;
        bySrc[src] = (bySrc[src] || 0) + 1;
      }
      return { total: all.length, byLayer, bySrc };
    });
    if (features.error) {
      log(`  ${features.error}`);
    } else {
      log(`  Total rendered features: ${features.total}`);
      log(`  By layer: ${JSON.stringify(features.byLayer)}`);
      log(`  By source: ${JSON.stringify(features.bySrc)}`);
    }

    // ── Test 6: Click facility feature for popup ──
    log('\n=== Test 6: Facility Click / Popup ===');
    // Try to find a facility feature and click it
    const clickResult = await page.evaluate(() => {
      if (!window.__gis_map) return { error: 'no map' };
      const map = window.__gis_map;
      // Find a facility point feature
      const facilityFeatures = map.queryRenderedFeatures().filter(f =>
        f.layer?.id?.includes('node') || f.layer?.id?.includes('pipe') ||
        f.layer?.id?.includes('facility') || f.layer?.id?.includes('FACILITY')
      );
      if (facilityFeatures.length === 0) return { found: 0 };

      const f = facilityFeatures[0];
      // Get pixel position of the feature
      let coords;
      if (f.geometry.type === 'Point') {
        coords = f.geometry.coordinates;
      } else if (f.geometry.type === 'LineString') {
        coords = f.geometry.coordinates[Math.floor(f.geometry.coordinates.length / 2)];
      }
      if (coords) {
        const pixel = map.project(coords);
        return {
          found: facilityFeatures.length,
          sampleLayer: f.layer?.id,
          sampleProps: Object.keys(f.properties || {}).slice(0, 10),
          clickX: pixel.x,
          clickY: pixel.y,
        };
      }
      return { found: facilityFeatures.length, noCoords: true };
    });
    log(`  Facility features found: ${clickResult.found || 0}`);
    if (clickResult.sampleLayer) {
      log(`  Sample layer: ${clickResult.sampleLayer}`);
      log(`  Sample properties: ${JSON.stringify(clickResult.sampleProps)}`);
    }

    if (clickResult.clickX && clickResult.clickY) {
      log(`  Clicking at (${Math.round(clickResult.clickX)}, ${Math.round(clickResult.clickY)})...`);
      await page.mouse.click(clickResult.clickX, clickResult.clickY);
      await delay(2000);
      await page.screenshot({ path: `${SS}/03-facility-click.png` });
      log('  Screenshot after click saved');

      // Check for popup or sidebar detail
      const popup = await page.locator('.maplibregl-popup').isVisible().catch(() => false);
      const detail = await page.locator('[class*="FacilityDetail"], [class*="facility-detail"]').isVisible().catch(() => false);
      log(`  MapLibre popup visible: ${popup}`);
      log(`  FacilityDetail sidebar visible: ${detail}`);
    }

    // ── Test 7: Layer toggling ──
    log('\n=== Test 7: Layer Toggle ===');
    // Find and toggle facility layers
    const checkboxes = await page.locator('input[type="checkbox"]').all();
    for (let i = 0; i < checkboxes.length; i++) {
      const label = await checkboxes[i].evaluate(el => el.closest('label')?.textContent?.trim() || el.parentElement?.textContent?.trim() || '');
      if (label.includes('시설물') || label.includes('facility') || label.includes('관로') || label.includes('맨홀')) {
        log(`  Toggling off: "${label}"`);
        await checkboxes[i].click();
        await delay(1000);
      }
    }
    await page.screenshot({ path: `${SS}/04-layers-toggled-off.png` });
    log('  Screenshot with facility layers off saved');

    // Toggle them back on
    for (let i = 0; i < checkboxes.length; i++) {
      const checked = await checkboxes[i].isChecked().catch(() => true);
      if (!checked) {
        await checkboxes[i].click();
        await delay(500);
      }
    }
    await delay(2000);
    await page.screenshot({ path: `${SS}/05-layers-toggled-on.png` });
    log('  Screenshot with all layers on saved');

    // ── Test 8: Different zoom levels ──
    log('\n=== Test 8: Different Zoom Levels ===');
    for (const z of [13, 14, 15]) {
      const ok = await page.evaluate((zoom) => {
        if (!window.__gis_map) return false;
        window.__gis_map.jumpTo({ center: [127.2, 37.9], zoom });
        return true;
      }, z);
      if (ok) {
        await delay(3000);
        await page.screenshot({ path: `${SS}/06-zoom-${z}.png` });
        const count = await page.evaluate(() => {
          if (!window.__gis_map) return 0;
          return window.__gis_map.queryRenderedFeatures().length;
        });
        log(`  z${z}: ${count} rendered features`);
      }
    }

    // ── Test 9: Search functionality ──
    log('\n=== Test 9: Search ===');
    const searchInput = await page.locator('input[type="text"][placeholder*="검색"], input[type="search"], input[placeholder*="주소"]').first();
    const searchVisible = await searchInput.isVisible().catch(() => false);
    log(`  Search input visible: ${searchVisible}`);
    if (searchVisible) {
      await searchInput.fill('포천');
      await delay(1000);
      await page.screenshot({ path: `${SS}/07-search.png` });
      log('  Screenshot after search saved');
    }

    // ── Summary ──
    log('\n=== Summary ===');
    log(`Console errors: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      for (const e of consoleErrors.slice(0, 5)) log(`  ERROR: ${e}`);
    }
    log(`Tile responses captured: ${tileResponses.length}`);
    const failedTiles = tileResponses.filter(t => t.status !== 200 && t.status !== 204);
    log(`Failed tile responses: ${failedTiles.length}`);
    if (failedTiles.length > 0) {
      for (const t of failedTiles.slice(0, 5)) log(`  FAIL: ${t.url} (${t.status})`);
    }

  } catch (err) {
    log(`FATAL: ${err.message}`);
    await page.screenshot({ path: `${SS}/error.png` }).catch(() => {});
  } finally {
    writeFileSync(`${SS}/qa-results.txt`, results.join('\n'));
    await browser.close();
    console.log('\n--- QA Complete ---');
  }
})();
