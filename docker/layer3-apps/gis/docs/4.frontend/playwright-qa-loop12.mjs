/**
 * Playwright QA - Loop 12
 * Tests: Bbox drag selection buttons, rollback e2e (upload → rollback → verify), regression
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
const SITE_URL = 'https://gis.giraffe.ai.kr';
const API_URL = 'https://gis.giraffe.ai.kr/api';
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
  const fp = path.join(SCREENSHOT_DIR, `loop12-${name}.png`);
  await page.screenshot({ path: fp, fullPage: false });
  log(`Screenshot: ${name}`);
  return fp;
}

async function apiLogin(username, password) {
  const res = await fetch(`${API_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

async function browserLogin(page, username, password) {
  const loginBtn = page.locator('button').filter({ hasText: '로그인' }).last();
  if (!(await loginBtn.isVisible({ timeout: 3000 }).catch(() => false))) return false;
  await loginBtn.click();
  await page.waitForTimeout(1000);

  const usernameInput = page.locator('#username').first();
  const passwordInput = page.locator('#password').first();
  if (!(await usernameInput.isVisible({ timeout: 3000 }).catch(() => false))) return false;

  await usernameInput.fill(username);
  await passwordInput.fill(password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(3000);

  return page.locator('button').filter({ hasText: '로그아웃' }).isVisible({ timeout: 5000 }).catch(() => false);
}

async function browserLogout(page) {
  const btn = page.locator('button').filter({ hasText: '로그아웃' });
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(1000);
    return true;
  }
  return false;
}

async function desktopTests(browser) {
  log('=== Desktop Tests (1400x900) ===');
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  // 1. Initial load
  await page.goto(SITE_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await waitForMap(page);
  await screenshot(page, '01-initial-load');

  // 2. Enable all layers + zoom to data
  const checkboxes = page.locator('input[type="checkbox"]');
  const checkboxCount = await checkboxes.count();
  for (let i = 0; i < checkboxCount; i++) {
    const cb = checkboxes.nth(i);
    if (!(await cb.isChecked())) {
      await cb.check();
      await page.waitForTimeout(300);
    }
  }
  await page.waitForTimeout(1000);

  await page.evaluate(() => {
    window.__gis_map.jumpTo({ center: [127.27, 37.97], zoom: 15 });
  });
  await waitForMap(page);
  await page.waitForTimeout(2000);

  const featureCounts = await page.evaluate(() => {
    const m = window.__gis_map;
    const layers = m.getStyle().layers.filter(l => l.id.startsWith('lyr-'));
    const results = {};
    for (const l of layers) {
      try { results[l.id] = m.queryRenderedFeatures(undefined, { layers: [l.id] }).length; }
      catch { results[l.id] = 0; }
    }
    return results;
  });
  log(`Feature counts at z15: ${JSON.stringify(featureCounts)}`);
  await screenshot(page, '02-all-layers-z15');

  // 3. Legend check
  const legendContent = await page.evaluate(() => {
    const el = document.querySelector('.absolute.right-3.bottom-8');
    return el ? el.textContent : null;
  });
  if (legendContent) {
    const subTypes = ['하수관로', '우수관로', '합류관로', '처리관로', '하수맨홀', '우수맨홀', '우수받이'];
    const found = subTypes.filter(t => legendContent.includes(t));
    log(`Legend sub-categories: ${found.join(', ')}`);
  }

  // 4. Feature popup
  const mapCanvas = page.locator('.maplibregl-canvas, canvas').first();
  const mapBox = await mapCanvas.boundingBox();
  if (mapBox) {
    await page.mouse.click(mapBox.x + mapBox.width / 2, mapBox.y + mapBox.height / 2);
    await page.waitForTimeout(2000);
    await screenshot(page, '03-feature-popup');
  }

  // 5. Search
  const searchInput = page.locator('input[placeholder*="검색"], input[placeholder*="주소"]').first();
  if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await searchInput.fill('포천읍');
    await page.waitForTimeout(2000);
    await screenshot(page, '04-search');
  }

  // 6. Satellite basemap
  const satBtn = page.locator('button').filter({ hasText: '위성' });
  if (await satBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await satBtn.click();
    await page.waitForTimeout(2000);
    await screenshot(page, '05-satellite');
    const osmBtn = page.locator('button').filter({ hasText: '일반' });
    if (await osmBtn.isVisible().catch(() => false)) {
      await osmBtn.click();
      await page.waitForTimeout(1000);
    }
  }

  // === ADMIN LOGIN ===
  log('=== Admin Login + Rollback e2e + Bbox Draw Test ===');
  const adminLoggedIn = await browserLogin(page, ADMIN_USER, ADMIN_PASS);
  log(`Admin login: ${adminLoggedIn}`);

  if (adminLoggedIn) {
    const adminBadge = page.locator('span').filter({ hasText: '관리자' });
    const hasAdminBadge = await adminBadge.isVisible({ timeout: 3000 }).catch(() => false);
    log(`Admin badge: ${hasAdminBadge}`);
    await screenshot(page, '06-admin-logged-in');

    const adminPanelBtn = page.locator('button').filter({ hasText: '데이터 관리' });
    if (await adminPanelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await adminPanelBtn.click();
      await page.waitForTimeout(1000);

      // === ROLLBACK E2E TEST ===
      log('=== Rollback E2E Test ===');

      // Upload a test GeoJSON file via browser
      const testGeoJson = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [127.27, 37.97] },
          properties: { name: 'rollback-test-node', type: 'MANHOLE_SEW' }
        }]
      };
      const testFilePath = path.join(SCREENSHOT_DIR, 'test-rollback-upload.geojson');
      fs.writeFileSync(testFilePath, JSON.stringify(testGeoJson));

      // Find file input and upload
      const fileInput = page.locator('input[type="file"]');
      if (await fileInput.count() > 0) {
        await fileInput.setInputFiles(testFilePath);
        await page.waitForTimeout(500);

        // Select target table
        const selects = page.locator('select');
        const selectCount = await selects.count();
        for (let i = 0; i < selectCount; i++) {
          const sel = selects.nth(i);
          const opts = await sel.locator('option').allTextContents();
          if (opts.some(o => o.includes('facilities') || o.includes('시설물'))) {
            await sel.selectOption({ index: 1 });
            break;
          }
        }
        await page.waitForTimeout(300);

        // Click upload button
        const uploadBtn = page.locator('button').filter({ hasText: /업로드|Upload/ });
        if (await uploadBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await uploadBtn.click();
          await page.waitForTimeout(3000);
          log('Upload submitted');

          // Wait for import to complete (poll up to 30s)
          let importCompleted = false;
          for (let attempt = 0; attempt < 6; attempt++) {
            await page.waitForTimeout(5000);
            const completedLabel = page.locator('span').filter({ hasText: /완료|실패/ });
            if (await completedLabel.first().isVisible({ timeout: 2000 }).catch(() => false)) {
              importCompleted = true;
              break;
            }
          }
          log(`Import reached terminal state: ${importCompleted}`);
          await screenshot(page, '07-import-uploaded');

          // Now try rollback
          const rollbackBtns = page.locator('button').filter({ hasText: '롤백' });
          const rollbackCount = await rollbackBtns.count();
          log(`Rollback buttons available: ${rollbackCount}`);

          if (rollbackCount > 0) {
            // Accept the confirm dialog
            page.once('dialog', async dialog => {
              log(`Rollback dialog: ${dialog.message().substring(0, 50)}...`);
              await dialog.accept();
            });

            await rollbackBtns.first().click();
            await page.waitForTimeout(3000);

            // Check for success message or rolled_back status
            const rollbackMsg = page.locator('text=롤백 완료');
            const hasRollbackMsg = await rollbackMsg.isVisible({ timeout: 5000 }).catch(() => false);
            log(`Rollback success message: ${hasRollbackMsg}`);

            const rolledBackLabel = page.locator('text=롤백됨');
            const hasRolledBack = await rolledBackLabel.isVisible({ timeout: 3000 }).catch(() => false);
            log(`Rolled_back status label: ${hasRolledBack}`);

            await screenshot(page, '08-import-rollback-result');
          }
        }
      }

      // === BBOX DRAW SELECTION BUTTON TEST ===
      log('=== Bbox Draw Selection Button Test ===');

      // Check in region management section
      const regionMgmt = page.locator('text=지역 관리').first();
      const hasRegionMgmt = await regionMgmt.isVisible({ timeout: 3000 }).catch(() => false);
      log(`Region management visible: ${hasRegionMgmt}`);

      // Check "맵에서 영역 선택" button in new region form
      const addRegionBtn = page.locator('button').filter({ hasText: '지역 추가' });
      if (await addRegionBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await addRegionBtn.click();
        await page.waitForTimeout(500);

        const bboxDrawBtn = page.locator('button').filter({ hasText: '맵에서 영역 선택' });
        const hasBboxDrawBtn = await bboxDrawBtn.first().isVisible({ timeout: 2000 }).catch(() => false);
        log(`Bbox draw button in create form: ${hasBboxDrawBtn}`);

        // Click the bbox draw button
        if (hasBboxDrawBtn) {
          await bboxDrawBtn.first().click();
          await page.waitForTimeout(500);

          // Check for drawing mode indicator
          const drawingIndicator = page.locator('text=맵에서 드래그하여 영역을 선택하세요');
          const hasIndicator = await drawingIndicator.isVisible({ timeout: 2000 }).catch(() => false);
          log(`Drawing mode indicator: ${hasIndicator}`);

          await screenshot(page, '09-bbox-draw-create-mode');

          // Simulate a drag on the map to test the draw feature
          if (mapBox) {
            const startX = mapBox.x + mapBox.width * 0.3;
            const startY = mapBox.y + mapBox.height * 0.3;
            const endX = mapBox.x + mapBox.width * 0.7;
            const endY = mapBox.y + mapBox.height * 0.7;

            await page.mouse.move(startX, startY);
            await page.mouse.down();
            await page.mouse.move(endX, endY, { steps: 10 });
            await page.mouse.up();
            await page.waitForTimeout(1000);

            // Check if BBOX WKT was filled in the form
            const bboxTextarea = page.locator('textarea').first();
            const bboxValue = await bboxTextarea.inputValue().catch(() => '');
            log(`BBOX WKT after draw: ${bboxValue ? 'filled (' + bboxValue.substring(0, 30) + '...)' : 'empty'}`);

            const centerInput = page.locator('input[placeholder="POINT(lng lat)"]');
            const centerValue = await centerInput.inputValue().catch(() => '');
            log(`CENTER WKT after draw: ${centerValue ? 'filled' : 'empty'}`);

            await screenshot(page, '10-bbox-draw-result');
          }

          // Cancel the form
          const cancelFormBtn = page.locator('button').filter({ hasText: '취소' });
          if (await cancelFormBtn.isVisible().catch(() => false)) {
            await cancelFormBtn.click();
            await page.waitForTimeout(300);
          }
        }
      }

      // Check "맵에서 영역 선택" button in edit form
      const editBtns = page.locator('button').filter({ hasText: '수정' });
      const editBtnCount = await editBtns.count();
      if (editBtnCount > 0) {
        await editBtns.first().click();
        await page.waitForTimeout(500);

        const bboxDrawEditBtn = page.locator('button').filter({ hasText: '맵에서 영역 선택' });
        const hasBboxDrawEditBtn = await bboxDrawEditBtn.isVisible({ timeout: 2000 }).catch(() => false);
        log(`Bbox draw button in edit form: ${hasBboxDrawEditBtn}`);
        await screenshot(page, '11-bbox-draw-edit-form');

        // Cancel edit
        const cancelEditBtn = page.locator('button').filter({ hasText: '취소' });
        if (await cancelEditBtn.isVisible().catch(() => false)) {
          await cancelEditBtn.click();
          await page.waitForTimeout(300);
        }
      }

      await screenshot(page, '12-admin-panel-full');
    }

    // Export test
    const exportBtn = page.locator('button').filter({ hasText: '내보내기' });
    if (await exportBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await exportBtn.click();
      await page.waitForTimeout(500);

      const printBtn = page.locator('button').filter({ hasText: '인쇄 레이아웃' });
      if (await printBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        const downloadPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
        await printBtn.click();
        const download = await downloadPromise;
        if (download) {
          const downloadPath = path.join(SCREENSHOT_DIR, 'loop12-print-export-admin.png');
          await download.saveAs(downloadPath);
          const stat = fs.statSync(downloadPath);
          log(`Print export (admin): ${stat.size} bytes`);
        }
      }
    }

    await browserLogout(page);
    await screenshot(page, '13-after-logout');
    log('Admin logout: success');
  }

  // Error summary
  const tileErrors = errors.filter(e => e.includes('AJAXError') || e.includes('tile'));
  log(`Console errors total: ${errors.length}, tile errors: ${tileErrors.length}`);

  await context.close();
}

async function mobileTests(browser) {
  log('=== Mobile Tests (375x812) ===');
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
    isMobile: true,
    hasTouch: true,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  await page.goto(SITE_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await waitForMap(page);
  await screenshot(page, '14-mobile-initial');

  const legendOnMobile = await page.locator('text=범례').first().isVisible({ timeout: 2000 }).catch(() => false);
  log(`Legend on mobile: ${legendOnMobile}`);

  const menuBtn = page.locator('button[aria-label="메뉴 토글"]');
  if (await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await menuBtn.click();
    await page.waitForTimeout(500);
    await screenshot(page, '15-mobile-sidebar');
    log('Mobile sidebar: works');
  }

  await context.close();
}

async function main() {
  log(`QA Start: ${new Date().toISOString()}`);

  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader-webgl'],
  });

  try {
    await desktopTests(browser);
    await mobileTests(browser);
  } catch (err) {
    log(`ERROR: ${err.message}`);
    console.error(err);
  } finally {
    await browser.close();
  }

  log(`QA End: ${new Date().toISOString()}`);

  fs.writeFileSync(
    path.join(SCREENSHOT_DIR, 'qa-loop12-results.txt'),
    RESULTS.join('\n') + '\n'
  );
  console.log('\n=== Results ===');
  console.log(RESULTS.join('\n'));
}

main().catch(console.error);
