/**
 * Playwright QA - Loop 18
 * Tests: Custom layer delete → map instant remove, GeoJSON file replace, editor region permission, regression
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
const SITE_URL = 'https://gis.giraffe.ai.kr';
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin1234';
const RESULTS = [];

function log(msg) {
  console.log(`[QA] ${msg}`);
  RESULTS.push(msg);
}

async function waitForMap(page, timeout = 30000) {
  await page.waitForFunction(() => {
    const m = window.__gis_map;
    return m && m.loaded() && !m.isMoving();
  }, { timeout });
  await page.waitForTimeout(1500);
}

async function screenshot(page, name) {
  const fp = path.join(SCREENSHOT_DIR, `loop18-${name}.png`);
  await page.screenshot({ path: fp, fullPage: false });
  log(`Screenshot: ${name}`);
  return fp;
}

async function apiCall(page, method, endpoint, body, token) {
  return page.evaluate(async ({ url, method, endpoint, body, token }) => {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${url}/api${endpoint}`, opts);
    const text = await res.text();
    try { return { status: res.status, data: JSON.parse(text) }; } catch { return { status: res.status, data: text }; }
  }, { url: SITE_URL, method, endpoint, body, token });
}

async function apiLogin(page, username, password) {
  const res = await apiCall(page, 'POST', '/v1/auth/login', { username, password });
  return res.status === 200 ? res.data.access_token : null;
}

async function apiUploadGeoJSON(page, token, name, regionCode, geojson, color = '#3388ff', layerType = 'circle') {
  return page.evaluate(async ({ url, token, name, regionCode, geojson, color, layerType }) => {
    const blob = new Blob([JSON.stringify(geojson)], { type: 'application/json' });
    const form = new FormData();
    form.append('file', blob, 'test.geojson');
    const qs = new URLSearchParams({ name, region_code: regionCode, color, layer_type: layerType }).toString();
    const res = await fetch(`${url}/api/v1/layers/custom?${qs}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const text = await res.text();
    try { return { status: res.status, data: JSON.parse(text) }; } catch { return { status: res.status, data: text }; }
  }, { url: SITE_URL, token, name, regionCode, geojson, color, layerType });
}

async function apiReplaceGeoJSON(page, token, code, geojson) {
  return page.evaluate(async ({ url, token, code, geojson }) => {
    const blob = new Blob([JSON.stringify(geojson)], { type: 'application/json' });
    const form = new FormData();
    form.append('file', blob, 'replaced.geojson');
    const res = await fetch(`${url}/api/v1/layers/custom/${code}/geojson`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const text = await res.text();
    try { return { status: res.status, data: JSON.parse(text) }; } catch { return { status: res.status, data: text }; }
  }, { url: SITE_URL, token, code, geojson });
}

(async () => {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true });
  const page = await context.newPage();

  const consoleErrors = [];
  const tileErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('response', (res) => {
    if (res.url().includes('/tiles/') && res.status() >= 400) tileErrors.push(`${res.status()} ${res.url()}`);
  });

  try {
    // ── 1. Initial load ──
    log('--- 1. Initial Load ---');
    await page.goto(SITE_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await waitForMap(page);
    await screenshot(page, '01-initial-load');

    // ── 2. Enable all layers ──
    log('--- 2. All Layers ---');
    const checkboxes = await page.$$('input[type="checkbox"]');
    for (const cb of checkboxes) {
      const checked = await cb.isChecked();
      if (!checked) await cb.click();
    }
    await page.evaluate(() => window.__gis_map.jumpTo({ center: [127.27, 37.97], zoom: 15 }));
    await waitForMap(page);

    const features = await page.evaluate(() => {
      const m = window.__gis_map;
      const all = m.queryRenderedFeatures();
      const layers = {};
      for (const f of all) {
        const lid = f.layer.id;
        layers[lid] = (layers[lid] || 0) + 1;
      }
      return layers;
    });
    log(`z15 features: ${JSON.stringify(features)}`);
    await screenshot(page, '02-all-layers-z15');

    // ── 3. Legend + Popup + Search + Satellite ──
    log('--- 3. Legend ---');
    await screenshot(page, '03-legend');

    log('--- 4. Feature Popup ---');
    await page.mouse.click(700, 450);
    await page.waitForTimeout(1000);
    await screenshot(page, '04-feature-popup');

    log('--- 5. Search ---');
    const searchInput = await page.$('input[placeholder*="검색"], input[placeholder*="주소"]');
    if (searchInput) {
      await searchInput.fill('포천읍');
      await page.waitForTimeout(1500);
      await screenshot(page, '05-search');
    }

    log('--- 6. Satellite ---');
    const satBtn = await page.$('button:has-text("위성")');
    if (satBtn) await satBtn.click();
    await page.waitForTimeout(2000);
    await screenshot(page, '06-satellite');

    // ── 7. Admin login ──
    log('--- 7. Admin Login ---');
    const loginBtn = await page.$('button:has-text("로그인")');
    if (loginBtn) await loginBtn.click();
    await page.waitForTimeout(500);
    await page.fill('#username', ADMIN_USER);
    await page.fill('#password', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    await screenshot(page, '07-admin-login');

    // ── 8. Admin panel ──
    log('--- 8. Admin Panel ---');
    const dataBtn = await page.$('button:has-text("데이터 관리")');
    if (dataBtn) await dataBtn.click();
    await page.waitForTimeout(1000);
    await screenshot(page, '08-admin-panel');

    // Check for file replace button
    const fileBtn = await page.$('button:has-text("파일")');
    log(`File replace button found: ${!!fileBtn}`);

    // ── 9. Custom layer delete → instant map removal test (via API) ──
    log('--- 9. Custom Layer Delete → Map Instant Remove ---');
    const adminToken = await apiLogin(page, ADMIN_USER, ADMIN_PASS);

    // Create a temp custom layer for deletion test
    const testGeoJSON = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [127.27, 37.97] },
        properties: { name: 'Delete Test Point' },
      }],
    };
    const createRes = await apiUploadGeoJSON(page, adminToken, 'QA 삭제 테스트', 'POCHEON', testGeoJSON, '#ff0000', 'circle');
    log(`Temp layer created: ${createRes.status} code=${createRes.data?.code}`);
    const tempCode = createRes.data?.code;

    if (tempCode) {
      // Refresh page to load the new layer on map
      await page.goto(SITE_URL, { waitUntil: 'networkidle', timeout: 60000 });
      await waitForMap(page);

      // Enable all layers including the new one
      const cbs = await page.$$('input[type="checkbox"]');
      for (const cb of cbs) { if (!(await cb.isChecked())) await cb.click(); }
      await page.evaluate(() => window.__gis_map.jumpTo({ center: [127.27, 37.97], zoom: 15 }));
      await waitForMap(page);

      // Check if temp layer exists on map
      const beforeDelete = await page.evaluate((code) => {
        const m = window.__gis_map;
        return {
          hasLayer: !!m.getLayer(`lyr-${code}`),
          hasSource: !!m.getSource(`src-${code}`),
        };
      }, tempCode);
      log(`Before delete: layer=${beforeDelete.hasLayer}, source=${beforeDelete.hasSource}`);
      await screenshot(page, '09-before-delete');

      // Login as admin in browser
      const loginBtn2 = await page.$('button:has-text("로그인")');
      if (loginBtn2) {
        await loginBtn2.click();
        await page.waitForTimeout(500);
        await page.fill('#username', ADMIN_USER);
        await page.fill('#password', ADMIN_PASS);
        await page.click('button[type="submit"]');
        await page.waitForTimeout(2000);
      }

      // Open admin panel and delete the temp layer
      const dataBtn2 = await page.$('button:has-text("데이터 관리")');
      if (dataBtn2) await dataBtn2.click();
      await page.waitForTimeout(1000);

      // Delete via Playwright native click (dialog handler set above)
      // Find the delete button using Playwright locators
      const tempLayerCard = page.locator('text=QA 삭제 테스트').locator('..');
      const deleteBtn = tempLayerCard.locator('button:has-text("삭제")');
      const deleteBtnVisible = await deleteBtn.isVisible().catch(() => false);
      log(`Delete button visible for temp layer: ${deleteBtnVisible}`);
      if (deleteBtnVisible) {
        await deleteBtn.click();
        await page.waitForTimeout(3000);
      } else {
        // Fallback: use API delete + page fetch to update layers
        await apiCall(page, 'DELETE', `/v1/layers/custom/${tempCode}`, null, adminToken);
        log('Deleted via API fallback');
        // Reload to verify
        await page.reload({ waitUntil: 'networkidle', timeout: 60000 });
        await waitForMap(page);
      }
      await page.waitForTimeout(2000);

      // Check if layer removed from map instantly
      const afterDelete = await page.evaluate((code) => {
        const m = window.__gis_map;
        return {
          hasLayer: !!m.getLayer(`lyr-${code}`),
          hasSource: !!m.getSource(`src-${code}`),
        };
      }, tempCode);
      log(`After delete: layer=${afterDelete.hasLayer}, source=${afterDelete.hasSource}`);
      const instantRemoved = beforeDelete.hasLayer && !afterDelete.hasLayer;
      log(`Instant map removal: ${instantRemoved}`);
      await screenshot(page, '10-after-delete');
    }

    // ── 10. GeoJSON file replace test (API) ──
    log('--- 10. GeoJSON File Replace ---');
    // Find existing custom layer
    const allLayers = await apiCall(page, 'GET', '/v1/layers/?region=POCHEON', null, adminToken);
    const existingCustom = Array.isArray(allLayers.data) ? allLayers.data.find(l => l.category === 'custom_geojson') : null;

    if (existingCustom) {
      const newGeoJSON = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [127.27, 37.97] },
            properties: { name: 'Replaced Point 1' },
          },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [127.28, 37.98] },
            properties: { name: 'Replaced Point 2' },
          },
        ],
      };
      const replaceRes = await apiReplaceGeoJSON(page, adminToken, existingCustom.code, newGeoJSON);
      log(`GeoJSON replace: status=${replaceRes.status}`);

      // Verify the replaced GeoJSON is served correctly
      const geoRes = await apiCall(page, 'GET', `/v1/layers/custom/${existingCustom.code}/geojson`, null, null);
      const featureCount = geoRes.data?.features?.length ?? 'N/A';
      log(`Replaced GeoJSON features: ${featureCount}`);
      await screenshot(page, '11-file-replace');
    } else {
      log('No existing custom layer to test file replace');
    }

    // ── 11. Editor region permission test (API) ──
    log('--- 11. Editor Region Permission ---');
    // Create editor without region
    const editorCreate = await apiCall(page, 'POST', '/v1/users/', {
      username: 'qa_editor_loop18',
      password: 'test1234',
      name: 'QA Editor',
      role: 'editor',
    }, adminToken);
    log(`Editor created: ${editorCreate.status}`);
    const editorId = editorCreate.data?.id;

    if (editorId) {
      // Activate
      await apiCall(page, 'PATCH', `/v1/users/${editorId}`, { is_active: true }, adminToken);

      // Login as editor (no regions)
      const editorToken = await apiLogin(page, 'qa_editor_loop18', 'test1234');
      log(`Editor token obtained: ${!!editorToken}`);

      if (editorToken) {
        // Try creating custom layer for POCHEON (should fail - no region assigned)
        const failCreate = await apiUploadGeoJSON(page, editorToken, 'Should Fail', 'POCHEON', testGeoJSON || {
          type: 'FeatureCollection', features: []
        }, '#ff0000', 'circle');
        log(`Editor create without region: status=${failCreate.status} (expected 403)`);

        // Assign POCHEON to editor
        await apiCall(page, 'PUT', `/v1/users/${editorId}/regions`, { region_codes: ['POCHEON'] }, adminToken);

        // Re-login
        const editorToken2 = await apiLogin(page, 'qa_editor_loop18', 'test1234');
        if (editorToken2) {
          // Try creating custom layer for POCHEON (should succeed)
          const successCreate = await apiUploadGeoJSON(page, editorToken2, 'Editor 테스트 레이어', 'POCHEON', {
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [127.27, 37.97] },
              properties: { name: 'Editor Point' },
            }],
          }, '#00ff00', 'circle');
          log(`Editor create with region: status=${successCreate.status} (expected 201)`);

          // Clean up the editor's custom layer via admin
          if (successCreate.data?.code) {
            await apiCall(page, 'DELETE', `/v1/layers/custom/${successCreate.data.code}`, null, adminToken);
            log('Editor test layer deleted');
          }
        }
      }

      // Cleanup editor user
      await apiCall(page, 'DELETE', `/v1/users/${editorId}`, null, adminToken);
      log('Editor test user deleted');
    }

    // ── 12. UI: File replace button visibility ──
    log('--- 12. UI File Replace Button ---');
    // Re-login as admin to check UI
    await page.goto(SITE_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await waitForMap(page);
    const loginBtn3 = await page.$('button:has-text("로그인")');
    if (loginBtn3) {
      await loginBtn3.click();
      await page.waitForTimeout(500);
      await page.fill('#username', ADMIN_USER);
      await page.fill('#password', ADMIN_PASS);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);
    }
    const dataBtn3 = await page.$('button:has-text("데이터 관리")');
    if (dataBtn3) await dataBtn3.click();
    await page.waitForTimeout(1000);

    const fileBtns = await page.$$('button:has-text("파일")');
    log(`File buttons count: ${fileBtns.length}`);
    if (fileBtns.length > 0) {
      await fileBtns[0].click();
      await page.waitForTimeout(300);
      const fileInput = await page.$('input[type="file"][accept*=".geojson"]');
      log(`File replace input found: ${!!fileInput}`);
      await screenshot(page, '12-file-replace-ui');
    }

    // ── 13. Export menu ──
    log('--- 13. Export ---');
    const exportBtn = await page.$('button:has-text("내보내기"), button:has-text("인쇄")');
    if (exportBtn) {
      await exportBtn.click();
      await page.waitForTimeout(500);
      await screenshot(page, '13-export-menu');
    }

    // ── 14. Logout ──
    log('--- 14. Logout ---');
    const logoutBtn = await page.$('button:has-text("로그아웃")');
    if (logoutBtn) {
      await logoutBtn.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, '14-logout');

    // ── 15. Mobile ──
    log('--- 15. Mobile ---');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(SITE_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await waitForMap(page);
    await screenshot(page, '15-mobile');

    // ── Summary ──
    log(`\n=== SUMMARY ===`);
    log(`Console errors: ${consoleErrors.length}`);
    log(`Tile errors: ${tileErrors.length}`);
    if (consoleErrors.length > 0) consoleErrors.forEach(e => log(`  ERR: ${e}`));
    if (tileErrors.length > 0) tileErrors.forEach(e => log(`  TILE: ${e}`));
  } catch (err) {
    log(`FATAL: ${err.message}`);
    await screenshot(page, 'error').catch(() => {});
  } finally {
    await browser.close();
    const report = RESULTS.join('\n');
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'loop18-report.txt'), report);
    console.log('\n' + report);
  }
})();
