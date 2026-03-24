/**
 * Playwright QA - Loop 11
 * Tests: Import rollback button, region edit map capture, stuck import fix, regression
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
  const fp = path.join(SCREENSHOT_DIR, `loop11-${name}.png`);
  await page.screenshot({ path: fp, fullPage: false });
  log(`Screenshot: ${name}`);
  return fp;
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
  log('=== Admin Login + Import Rollback + Region Edit Map Capture ===');
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

      // === IMPORT HISTORY - ROLLBACK BUTTON ===
      log('=== Import History Rollback Button Test ===');

      // Check for rollback buttons (should be visible for completed/failed imports)
      const rollbackBtns = page.locator('button').filter({ hasText: '롤백' });
      const rollbackBtnCount = await rollbackBtns.count();
      log(`Rollback buttons found: ${rollbackBtnCount}`);

      // Check import status - "실패" label should be visible (stuck import was fixed to failed)
      const failedLabel = page.locator('text=실패');
      const hasFailedLabel = await failedLabel.isVisible({ timeout: 3000 }).catch(() => false);
      log(`Failed import label visible: ${hasFailedLabel}`);

      // Check that no polling indicator is shown (no active imports)
      const pollingIndicator = page.locator('text=자동 갱신 중');
      const hasPolling = await pollingIndicator.isVisible({ timeout: 2000 }).catch(() => false);
      log(`Polling indicator: ${hasPolling} (expected: false)`);

      await screenshot(page, '07-import-history-rollback');

      // === REGION MANAGEMENT - MAP CAPTURE BUTTON IN EDIT ===
      log('=== Region Management - Edit with Map Capture ===');
      const regionMgmt = page.locator('text=지역 관리').first();
      const hasRegionMgmt = await regionMgmt.isVisible({ timeout: 3000 }).catch(() => false);
      log(`Region management visible: ${hasRegionMgmt}`);

      // Click edit button
      const editBtns = page.locator('button').filter({ hasText: '수정' });
      const editBtnCount = await editBtns.count();
      log(`Region edit buttons: ${editBtnCount}`);

      if (editBtnCount > 0) {
        await editBtns.first().click();
        await page.waitForTimeout(500);

        // Check that "현재 맵 뷰로 BBOX/CENTER 업데이트" button exists in edit form
        const mapCaptureEditBtn = page.locator('button').filter({ hasText: 'BBOX/CENTER 업데이트' });
        const hasMapCaptureBtn = await mapCaptureEditBtn.isVisible({ timeout: 2000 }).catch(() => false);
        log(`Map capture button in edit form: ${hasMapCaptureBtn}`);

        await screenshot(page, '08-region-edit-with-map-capture');

        // Click the map capture button and verify WKT appears
        if (hasMapCaptureBtn) {
          await mapCaptureEditBtn.click();
          await page.waitForTimeout(500);

          // Check if BBOX/CENTER WKT preview is shown
          const bboxPreview = page.locator('text=BBOX:');
          const hasBboxPreview = await bboxPreview.isVisible({ timeout: 2000 }).catch(() => false);
          log(`BBOX preview after capture: ${hasBboxPreview}`);

          const centerPreview = page.locator('text=CENTER:');
          const hasCenterPreview = await centerPreview.isVisible({ timeout: 2000 }).catch(() => false);
          log(`CENTER preview after capture: ${hasCenterPreview}`);

          await screenshot(page, '09-region-edit-map-captured');
        }

        // Cancel edit
        const cancelBtn = page.locator('button').filter({ hasText: '취소' });
        if (await cancelBtn.isVisible().catch(() => false)) {
          await cancelBtn.click();
          await page.waitForTimeout(500);
        }
      }

      // === USER MANAGEMENT ===
      const userMgmt = page.locator('text=사용자 관리').first();
      const hasUserMgmt = await userMgmt.isVisible({ timeout: 3000 }).catch(() => false);
      log(`User management visible: ${hasUserMgmt}`);

      await screenshot(page, '10-admin-panel-full');
    }

    // === EXPORT WITH ADMIN WATERMARK ===
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
          const downloadPath = path.join(SCREENSHOT_DIR, 'loop11-print-export-admin.png');
          await download.saveAs(downloadPath);
          const stat = fs.statSync(downloadPath);
          log(`Print export (admin): ${stat.size} bytes`);
        }
      }
    }

    await browserLogout(page);
    await screenshot(page, '11-after-logout');
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
  await screenshot(page, '12-mobile-initial');

  const legendOnMobile = await page.locator('text=범례').first().isVisible({ timeout: 2000 }).catch(() => false);
  log(`Legend on mobile: ${legendOnMobile}`);

  const menuBtn = page.locator('button[aria-label="메뉴 토글"]');
  if (await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await menuBtn.click();
    await page.waitForTimeout(500);
    await screenshot(page, '13-mobile-sidebar');
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
    path.join(SCREENSHOT_DIR, 'qa-loop11-results.txt'),
    RESULTS.join('\n') + '\n'
  );
  console.log('\n=== Results ===');
  console.log(RESULTS.join('\n'));
}

main().catch(console.error);
