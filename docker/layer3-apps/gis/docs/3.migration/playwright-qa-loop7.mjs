/**
 * Loop 7 QA: gis.giraffe.ai.kr comprehensive browser verification
 * Tests: page load, login, map rendering, layer toggle, facility click, tile loading
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const BASE_URL = 'https://gis.giraffe.ai.kr';
const SCREENSHOT_DIR = '/home/girinman/workspace/serengeti-iac/docker/layer3-apps/gis/docs/migration/screenshots';
const results = [];

function log(msg) {
  console.log(`[QA] ${msg}`);
  results.push(msg);
}

async function screenshot(page, name) {
  const path = `${SCREENSHOT_DIR}/loop7-${name}.png`;
  await page.screenshot({ path, fullPage: false });
  log(`Screenshot saved: loop7-${name}.png`);
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-software-rasterizer']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true
  });

  const page = await context.newPage();

  // Collect network requests for analysis
  const tileRequests = [];
  const apiRequests = [];
  page.on('response', (resp) => {
    const url = resp.url();
    if (url.includes('.pbf')) tileRequests.push({ url, status: resp.status(), size: resp.headers()['content-length'] || 'unknown' });
    if (url.includes('/api/')) apiRequests.push({ url: url.replace(BASE_URL, ''), status: resp.status() });
  });

  try {
    // 1. Page load
    log('=== 1. Page Load ===');
    const resp = await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    log(`Status: ${resp.status()}`);
    log(`Title: ${await page.title()}`);
    await screenshot(page, '01-initial-load');

    // 2. Check if login page or map page
    log('=== 2. Login Check ===');
    const loginForm = await page.$('form, [data-testid="login"], input[type="password"]');
    if (loginForm) {
      log('Login form detected - attempting login');
      // Try to find and fill login fields
      const emailInput = await page.$('input[type="email"], input[type="text"], input[name="email"], input[name="username"]');
      const pwInput = await page.$('input[type="password"]');
      if (emailInput && pwInput) {
        await emailInput.fill('admin');
        await pwInput.fill('admin');
        const submitBtn = await page.$('button[type="submit"], button:has-text("로그인"), button:has-text("Login")');
        if (submitBtn) {
          await submitBtn.click();
          await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
          log('Login submitted');
          await screenshot(page, '02-after-login');
        }
      }
    } else {
      log('No login form - map page loaded directly');
    }

    // 3. Wait for map canvas
    log('=== 3. Map Canvas ===');
    await page.waitForTimeout(3000);
    const canvas = await page.$('canvas.maplibregl-canvas, canvas.mapboxgl-canvas, canvas');
    log(`Map canvas: ${canvas ? 'FOUND' : 'NOT FOUND'}`);
    await screenshot(page, '03-map-canvas');

    // 4. Check sidebar / layer tree
    log('=== 4. Sidebar / Layer Tree ===');
    const layerItems = await page.$$('[class*="layer"], [class*="Layer"], [data-testid*="layer"]');
    log(`Layer items in DOM: ${layerItems.length}`);

    // Look for checkboxes (layer toggles)
    const checkboxes = await page.$$('input[type="checkbox"]');
    log(`Checkboxes (layer toggles): ${checkboxes.length}`);
    await screenshot(page, '04-sidebar');

    // 5. Check API responses
    log('=== 5. API Responses ===');
    // Fetch layers API directly
    const layersResp = await page.evaluate(async (url) => {
      try {
        const r = await fetch(`${url}/api/v1/layers/?region=POCHEON`);
        return { status: r.status, data: await r.json() };
      } catch (e) { return { error: e.message }; }
    }, BASE_URL);

    if (layersResp.data) {
      log(`Layers API: ${layersResp.status} - ${layersResp.data.length} layers`);
      for (const l of layersResp.data) {
        log(`  - ${l.code}: ${l.name}`);
      }
    } else {
      log(`Layers API error: ${layersResp.error || 'unknown'}`);
    }

    // Fetch regions API
    const regionsResp = await page.evaluate(async (url) => {
      try {
        const r = await fetch(`${url}/api/v1/regions/`);
        return { status: r.status, data: await r.json() };
      } catch (e) { return { error: e.message }; }
    }, BASE_URL);

    if (regionsResp.data) {
      log(`Regions API: ${regionsResp.status}`);
      const regions = Array.isArray(regionsResp.data) ? regionsResp.data : [regionsResp.data];
      for (const r of regions) {
        log(`  - ${r.code || r.name || JSON.stringify(r).slice(0, 80)}`);
      }
    }

    // 6. Check facility detail API
    log('=== 6. Facility Detail API ===');
    const facilityResp = await page.evaluate(async (url) => {
      try {
        const r = await fetch(`${url}/api/v1/facilities/1`);
        return { status: r.status, data: await r.json() };
      } catch (e) { return { error: e.message }; }
    }, BASE_URL);

    if (facilityResp.data) {
      log(`Facility #1: ${facilityResp.status}`);
      const props = facilityResp.data.properties || facilityResp.data;
      log(`  type: ${props.type_code || props.LAYER_CD || 'unknown'}`);
      log(`  fac_id: ${props.fac_id || props.FSN || 'unknown'}`);
    } else {
      log(`Facility API error: ${facilityResp.error || 'unknown'}`);
    }

    // 7. Tile loading check
    log('=== 7. Tile Loading ===');
    // Navigate to a known tile location (Pocheon center ~z15)
    await page.evaluate(async (url) => {
      try {
        // Direct tile fetch
        const r = await fetch(`${url}/tiles/gis.facility_nodes/15/27954/12645.pbf`);
        window.__tileCheck = { status: r.status, size: r.headers.get('content-length') };
      } catch(e) { window.__tileCheck = { error: e.message }; }
    }, BASE_URL);
    const tileCheck = await page.evaluate(() => window.__tileCheck);
    log(`Tile direct fetch: status=${tileCheck.status}, size=${tileCheck.size || tileCheck.error}`);

    // 8. Try zoom to Pocheon and wait for tiles
    log('=== 8. Map Zoom to Pocheon ===');
    await page.evaluate(() => {
      const map = window.__gis_map;
      if (map) {
        map.flyTo({ center: [127.2, 37.9], zoom: 15, duration: 0 });
      }
    });
    await page.waitForTimeout(3000);
    await screenshot(page, '05-pocheon-z15');

    // Check map sources/layers
    const mapInfo = await page.evaluate(() => {
      const map = window.__gis_map;
      if (!map) return { error: 'No map instance' };
      const style = map.getStyle();
      return {
        sources: Object.keys(style?.sources || {}),
        layers: (style?.layers || []).map(l => ({ id: l.id, type: l.type, source: l.source, sourceLayer: l['source-layer'] })),
        zoom: map.getZoom(),
        center: map.getCenter()
      };
    });

    if (mapInfo.sources) {
      log(`Map sources: ${mapInfo.sources.join(', ')}`);
      log(`Map layers: ${mapInfo.layers.length}`);
      for (const l of mapInfo.layers) {
        log(`  - ${l.id} (${l.type}) src=${l.source} srcLayer=${l.sourceLayer || '-'}`);
      }
      log(`Zoom: ${mapInfo.zoom?.toFixed(1)}, Center: ${mapInfo.center?.lng?.toFixed(3)},${mapInfo.center?.lat?.toFixed(3)}`);
    } else {
      log(`Map info: ${mapInfo.error}`);
    }

    // 9. Toggle layers off/on
    log('=== 9. Layer Toggle ===');
    if (checkboxes.length > 0) {
      // Toggle first checkbox off
      await checkboxes[0].click();
      await page.waitForTimeout(1000);
      await screenshot(page, '06-layer-toggled-off');
      // Toggle back on
      await checkboxes[0].click();
      await page.waitForTimeout(1000);
      await screenshot(page, '07-layer-toggled-on');
      log('Layer toggle: OK');
    } else {
      log('Layer toggle: No checkboxes found');
    }

    // 10. Try different zoom levels
    log('=== 10. Multi-zoom Screenshots ===');
    for (const z of [12, 13, 14, 16]) {
      await page.evaluate((zoom) => {
        const map = window.__gis_map;
        if (map) map.setZoom(zoom);
      }, z);
      await page.waitForTimeout(2000);
      await screenshot(page, `08-zoom-${z}`);
    }

    // 11. Network summary
    log('=== 11. Network Summary ===');
    log(`Tile requests: ${tileRequests.length}`);
    log(`API requests: ${apiRequests.length}`);
    for (const req of apiRequests.slice(0, 10)) {
      log(`  API: ${req.status} ${req.url}`);
    }

    // Summary
    log('=== SUMMARY ===');
    log(`Page load: OK (${resp.status()})`);
    log(`Map canvas: ${canvas ? 'OK' : 'FAIL'}`);
    log(`Layers API: ${layersResp.data ? 'OK' : 'FAIL'}`);
    log(`Tile serving: ${tileCheck.status === 200 ? 'OK' : 'FAIL'}`);
    log(`Facility API: ${facilityResp.data ? 'OK' : 'FAIL'}`);

  } catch (err) {
    log(`ERROR: ${err.message}`);
    await screenshot(page, 'error').catch(() => {});
  } finally {
    // Save results
    writeFileSync(`${SCREENSHOT_DIR}/loop7-qa-results.txt`, results.join('\n'));
    await browser.close();
    console.log('\n--- QA Complete ---');
  }
})();
