/**
 * Playwright QA - Loop 17
 * Tests: Custom layer live style update, rename, region-based layer filtering, regression
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
  const fp = path.join(SCREENSHOT_DIR, `loop17-${name}.png`);
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

    // Check custom layer on map
    const customOnMap = await page.evaluate(() => {
      const m = window.__gis_map;
      const styles = m.getStyle();
      const customLayers = styles.layers.filter(l => l.id.startsWith('lyr-custom_'));
      const customSources = Object.keys(styles.sources).filter(s => s.startsWith('src-custom_'));
      return { layers: customLayers.map(l => l.id), sources: customSources };
    });
    log(`Custom layers on map: ${JSON.stringify(customOnMap)}`);

    // ── 3. Legend ──
    log('--- 3. Legend ---');
    await screenshot(page, '03-legend');

    // ── 4. Feature popup ──
    log('--- 4. Feature Popup ---');
    await page.mouse.click(700, 450);
    await page.waitForTimeout(1000);
    await screenshot(page, '04-feature-popup');

    // ── 5. Search ──
    log('--- 5. Search ---');
    const searchInput = await page.$('input[placeholder*="검색"], input[placeholder*="주소"]');
    if (searchInput) {
      await searchInput.fill('포천읍');
      await page.waitForTimeout(1500);
      await screenshot(page, '05-search');
    }

    // ── 6. Satellite basemap ──
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

    const adminBadge = await page.textContent('.inline-flex, [class*="badge"]').catch(() => '');
    log(`Admin badge: ${adminBadge}`);

    // ── 8. Admin panel - Custom Layer section ──
    log('--- 8. Custom Layer Management ---');
    const dataBtn = await page.$('button:has-text("데이터 관리")');
    if (dataBtn) await dataBtn.click();
    await page.waitForTimeout(1000);
    await screenshot(page, '08-admin-panel');

    // Check rename button exists
    const renameBtn = await page.$('button:has-text("이름")');
    log(`Rename button found: ${!!renameBtn}`);

    // Check style button exists
    const styleBtn = await page.$('button:has-text("스타일")');
    log(`Style button found: ${!!styleBtn}`);
    await screenshot(page, '09-custom-layer-buttons');

    // ── 9. Test rename functionality ──
    log('--- 9. Custom Layer Rename ---');
    if (renameBtn) {
      await renameBtn.click();
      await page.waitForTimeout(300);
      const renameInput = await page.$('input[placeholder="새 이름"]');
      log(`Rename input found: ${!!renameInput}`);
      if (renameInput) {
        await renameInput.fill('');
        await renameInput.fill('QA 이름 변경 테스트');
        await screenshot(page, '10-rename-form');

        const renameSaveBtn = await page.$('button:has-text("저장"):not([type="submit"])');
        // Find the save button specifically in the rename form (gray bg)
        const renameFormBtns = await page.$$('button.bg-gray-600');
        if (renameFormBtns.length > 0) {
          await renameFormBtns[0].click();
          await page.waitForTimeout(1500);
          log('Rename save clicked');
        }
        await screenshot(page, '11-rename-result');
      }
    }

    // ── 10. Test style live update ──
    log('--- 10. Custom Layer Style Live Update ---');
    // Get the custom layer's current paint before style change
    const paintBefore = await page.evaluate(() => {
      const m = window.__gis_map;
      const customLayer = m.getStyle().layers.find(l => l.id.startsWith('lyr-custom_'));
      if (!customLayer) return null;
      return { id: customLayer.id, paint: customLayer.paint };
    });
    log(`Paint before: ${JSON.stringify(paintBefore)}`);

    // Click the style button for a custom layer
    const styleBtns = await page.$$('button:has-text("스타일")');
    if (styleBtns.length > 0) {
      await styleBtns[0].click();
      await page.waitForTimeout(300);
      await screenshot(page, '12-style-edit-form');

      // Change color
      const colorInput = await page.$('.border-violet-400 input[type="color"]');
      if (colorInput) {
        await colorInput.evaluate(el => { el.value = '#ff0000'; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); });
        log('Color changed to #ff0000');
      }

      // Save style
      const saveBtns = await page.$$('.border-violet-400 button.bg-violet-600');
      if (saveBtns.length > 0) {
        await saveBtns[0].click();
        await page.waitForTimeout(2000);
        log('Style save clicked');
      }

      // Check if map paint properties updated without refresh
      const paintAfter = await page.evaluate(() => {
        const m = window.__gis_map;
        const customLayer = m.getStyle().layers.find(l => l.id.startsWith('lyr-custom_'));
        if (!customLayer) return null;
        return { id: customLayer.id, paint: customLayer.paint };
      });
      log(`Paint after: ${JSON.stringify(paintAfter)}`);

      const liveUpdateWorked = paintBefore && paintAfter &&
        JSON.stringify(paintBefore.paint) !== JSON.stringify(paintAfter.paint);
      log(`Live style update worked (paint changed): ${liveUpdateWorked}`);
      await screenshot(page, '13-style-after-update');
    }

    // ── 11. Region-based layer filtering (API test) ──
    log('--- 11. Region-based Layer Filtering ---');
    const adminToken = await apiLogin(page, ADMIN_USER, ADMIN_PASS);
    log(`Admin token obtained: ${!!adminToken}`);

    // Create viewer user without region assignment
    const viewerCreate = await apiCall(page, 'POST', '/v1/users/', {
      username: 'qa_viewer_loop17',
      password: 'test1234',
      name: 'QA Viewer',
      role: 'viewer',
    }, adminToken);
    log(`Viewer created: ${viewerCreate.status}`);
    const viewerId = viewerCreate.data?.id;

    // Activate viewer
    if (viewerId) {
      await apiCall(page, 'PATCH', `/v1/users/${viewerId}`, { is_active: true }, adminToken);
    }

    // Login as viewer (no regions assigned)
    const viewerToken = await apiLogin(page, 'qa_viewer_loop17', 'test1234');
    log(`Viewer token obtained: ${!!viewerToken}`);

    // Viewer fetches layers without region assignment -> should get empty
    if (viewerToken) {
      const viewerLayers = await apiCall(page, 'GET', '/v1/layers/', null, viewerToken);
      log(`Viewer layers (no region): count=${Array.isArray(viewerLayers.data) ? viewerLayers.data.length : 'N/A'}`);

      // Assign POCHEON region to viewer
      await apiCall(page, 'PUT', `/v1/users/${viewerId}/regions`, { region_codes: ['POCHEON'] }, adminToken);

      // Re-login to refresh
      const viewerToken2 = await apiLogin(page, 'qa_viewer_loop17', 'test1234');
      if (viewerToken2) {
        const viewerLayersAfter = await apiCall(page, 'GET', '/v1/layers/?region=POCHEON', null, viewerToken2);
        log(`Viewer layers (POCHEON assigned): count=${Array.isArray(viewerLayersAfter.data) ? viewerLayersAfter.data.length : 'N/A'}`);
      }
    }

    // Cleanup viewer
    if (viewerId) {
      await apiCall(page, 'DELETE', `/v1/users/${viewerId}`, null, adminToken);
      log('Viewer test user deleted');
    }

    // ── 12. Rename back the custom layer (restore) ──
    log('--- 12. Restore Renamed Layer ---');
    // Use API to rename back
    const allLayers = await apiCall(page, 'GET', '/v1/layers/?region=POCHEON', null, adminToken);
    const customLayer = Array.isArray(allLayers.data) ? allLayers.data.find(l => l.category === 'custom_geojson') : null;
    if (customLayer) {
      const restoreRes = await apiCall(page, 'PATCH', `/v1/layers/custom/${customLayer.code}`, { name: 'QA 테스트 레이어' }, adminToken);
      log(`Layer name restored: ${restoreRes.status === 200}`);
    }

    // ── 13. Print PNG ──
    log('--- 13. Print Export ---');
    const exportBtn = await page.$('button:has-text("내보내기"), button:has-text("인쇄")');
    if (exportBtn) {
      await exportBtn.click();
      await page.waitForTimeout(500);
      await screenshot(page, '14-export-menu');
    }

    // ── 14. Logout ──
    log('--- 14. Logout ---');
    const logoutBtn = await page.$('button:has-text("로그아웃")');
    if (logoutBtn) {
      await logoutBtn.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, '15-logout');

    // ── 15. Mobile ──
    log('--- 15. Mobile ---');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(SITE_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await waitForMap(page);
    await screenshot(page, '16-mobile');

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
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'loop17-report.txt'), report);
    console.log('\n' + report);
  }
})();
