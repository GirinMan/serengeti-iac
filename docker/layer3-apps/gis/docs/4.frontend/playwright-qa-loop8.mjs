/**
 * Playwright QA - Loop 8
 * Tests: Editor role (data upload visible, user management hidden),
 *        MapExport watermark with username/role, overall regression
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
  const fp = path.join(SCREENSHOT_DIR, `loop8-${name}.png`);
  await page.screenshot({ path: fp, fullPage: false });
  log(`Screenshot: ${name}`);
  return fp;
}

async function apiLogin(page, username, password) {
  return page.evaluate(async ({ url, user, pass }) => {
    const res = await fetch(`${url}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, password: pass }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token;
  }, { url: SITE_URL, user: username, pass: password });
}

async function apiCreateUser(page, token, { username, password, name, role }) {
  return page.evaluate(async ({ url, token, body }) => {
    const res = await fetch(`${url}/api/v1/users/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return res.json();
  }, { url: SITE_URL, token, body: { username, password, name, role } });
}

async function apiDeleteUser(page, token, userId) {
  return page.evaluate(async ({ url, token, userId }) => {
    await fetch(`${url}/api/v1/users/${userId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
  }, { url: SITE_URL, token, userId });
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

  // 2. Select region & enable all layers
  const regionSelect = page.locator('select').first();
  if (await regionSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
    const options = await regionSelect.locator('option').allTextContents();
    log(`Region options: ${options.join(', ')}`);
    if (options.length > 1) {
      await regionSelect.selectOption({ index: 1 });
      await page.waitForTimeout(2000);
      await waitForMap(page);
    }
  }

  const checkboxes = page.locator('input[type="checkbox"]');
  const checkboxCount = await checkboxes.count();
  for (let i = 0; i < checkboxCount; i++) {
    const cb = checkboxes.nth(i);
    if (!(await cb.isChecked())) {
      await cb.check();
      await page.waitForTimeout(300);
    }
  }
  await page.waitForTimeout(2000);
  await screenshot(page, '02-all-layers-on');

  // 3. Zoom to data area
  await page.evaluate(() => {
    window.__gis_map.jumpTo({ center: [127.27, 37.97], zoom: 15 });
  });
  await waitForMap(page);
  await page.waitForTimeout(3000);

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
  await screenshot(page, '03-z15-features');

  // 4. Legend check
  const legendContent = await page.evaluate(() => {
    const el = document.querySelector('.absolute.right-3.bottom-8');
    return el ? el.textContent : null;
  });
  if (legendContent) {
    const subTypes = ['하수관로', '우수관로', '합류관로', '하수맨홀', '우수맨홀', '처리관로', '우수받이'];
    const found = subTypes.filter(t => legendContent.includes(t));
    log(`Legend sub-categories: ${found.join(', ')}`);
  }

  // 5. Click feature popup
  const mapCanvas = page.locator('.maplibregl-canvas, canvas').first();
  const mapBox = await mapCanvas.boundingBox();
  if (mapBox) {
    await page.mouse.click(mapBox.x + mapBox.width / 2, mapBox.y + mapBox.height / 2);
    await page.waitForTimeout(2000);
    await screenshot(page, '04-feature-popup');
  }

  // 6. Search
  const searchInput = page.locator('input[placeholder*="검색"], input[placeholder*="주소"]').first();
  if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await searchInput.fill('포천읍');
    await page.waitForTimeout(2000);
    await screenshot(page, '05-search');
  }

  // 7. Satellite basemap
  const satBtn = page.locator('button').filter({ hasText: '위성' });
  if (await satBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await satBtn.click();
    await page.waitForTimeout(2000);
    await screenshot(page, '06-satellite');
    const osmBtn = page.locator('button').filter({ hasText: '일반' });
    if (await osmBtn.isVisible().catch(() => false)) {
      await osmBtn.click();
      await page.waitForTimeout(1500);
    }
  }

  // === EDITOR ROLE TEST ===
  log('=== Editor Role Test ===');

  const adminToken = await apiLogin(page, ADMIN_USER, ADMIN_PASS);
  const editorUsername = `qaed_${Date.now() % 100000}`;
  const editorPass = 'test1234';
  let editorUserId = null;

  if (adminToken) {
    const createRes = await apiCreateUser(page, adminToken, {
      username: editorUsername,
      password: editorPass,
      name: 'QA Editor',
      role: 'editor',
    });

    if (createRes) {
      editorUserId = createRes.id;
      log(`Created editor test user: ${editorUsername} (id=${editorUserId})`);

      // Login as editor
      const loggedIn = await browserLogin(page, editorUsername, editorPass);
      log(`Editor login: ${loggedIn}`);

      if (loggedIn) {
        await page.waitForTimeout(1000);

        // Check editor role badge
        const editorBadge = page.locator('span').filter({ hasText: '편집자' });
        const hasBadge = await editorBadge.isVisible({ timeout: 3000 }).catch(() => false);
        log(`Editor role badge "편집자" visible: ${hasBadge}`);

        // Check AdminPanel IS visible for editor (data upload)
        const adminPanelBtn = page.locator('button').filter({ hasText: '데이터 관리' });
        const adminPanelVisible = await adminPanelBtn.isVisible({ timeout: 3000 }).catch(() => false);
        log(`Admin panel (데이터 관리) visible for editor: ${adminPanelVisible} (expected: true)`);

        await screenshot(page, '07-editor-logged-in');

        if (adminPanelVisible) {
          await adminPanelBtn.click();
          await page.waitForTimeout(500);

          // Check DataUpload is visible
          const fileUpload = page.locator('text=파일 업로드');
          const hasUpload = await fileUpload.isVisible({ timeout: 3000 }).catch(() => false);
          log(`File upload visible for editor: ${hasUpload} (expected: true)`);

          // Check ImportHistory is visible
          const importHistory = page.locator('text=수집 이력');
          const hasHistory = await importHistory.isVisible({ timeout: 3000 }).catch(() => false);
          log(`Import history visible for editor: ${hasHistory} (expected: true)`);

          // Check UserManagement is NOT visible for editor
          const userMgmt = page.locator('text=사용자 관리');
          const hasUserMgmt = await userMgmt.isVisible({ timeout: 2000 }).catch(() => false);
          log(`User management visible for editor: ${hasUserMgmt} (expected: false)`);

          await screenshot(page, '08-editor-admin-panel');
        }

        // === MAP EXPORT WATERMARK TEST (as editor) ===
        log('=== MapExport Watermark Test (editor) ===');

        // Click 내보내기 button
        const exportBtn = page.locator('button').filter({ hasText: '내보내기' });
        if (await exportBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await exportBtn.click();
          await page.waitForTimeout(500);

          // Click "인쇄 레이아웃" to trigger print export with watermark
          const printBtn = page.locator('button').filter({ hasText: '인쇄 레이아웃' });
          if (await printBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            const downloadPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
            await printBtn.click();
            const download = await downloadPromise;
            if (download) {
              const downloadPath = path.join(SCREENSHOT_DIR, 'loop8-print-export-editor.png');
              await download.saveAs(downloadPath);
              const stat = fs.statSync(downloadPath);
              log(`Print export (editor): ${stat.size} bytes - should contain watermark with "QA Editor (편집자)"`);
            } else {
              log('Print export (editor): download event not captured');
            }
          }
        }

        await screenshot(page, '09-editor-export-menu');

        // Logout editor
        await browserLogout(page);
        log('Editor logout: success');
      }
    }
  }

  // === ADMIN LOGIN & FULL PANEL CHECK ===
  log('=== Admin Role UI Test ===');
  const adminLoggedIn = await browserLogin(page, ADMIN_USER, ADMIN_PASS);
  log(`Admin login: ${adminLoggedIn}`);

  if (adminLoggedIn) {
    const adminBadge = page.locator('span').filter({ hasText: '관리자' });
    const hasAdminBadge = await adminBadge.isVisible({ timeout: 3000 }).catch(() => false);
    log(`Admin role badge "관리자" visible: ${hasAdminBadge}`);

    const adminPanelBtn = page.locator('button').filter({ hasText: '데이터 관리' });
    const adminPanelVisible = await adminPanelBtn.isVisible({ timeout: 3000 }).catch(() => false);
    log(`Admin panel visible for admin: ${adminPanelVisible} (expected: true)`);

    await screenshot(page, '10-admin-logged-in');

    if (adminPanelVisible) {
      await adminPanelBtn.click();
      await page.waitForTimeout(500);

      const userMgmt = page.locator('text=사용자 관리');
      const hasUserMgmt = await userMgmt.isVisible({ timeout: 3000 }).catch(() => false);
      log(`User management visible for admin: ${hasUserMgmt} (expected: true)`);

      await screenshot(page, '11-admin-panel-open');
    }

    // === MAP EXPORT WATERMARK TEST (as admin) ===
    log('=== MapExport Watermark Test (admin) ===');
    const exportBtn2 = page.locator('button').filter({ hasText: '내보내기' });
    if (await exportBtn2.isVisible({ timeout: 3000 }).catch(() => false)) {
      await exportBtn2.click();
      await page.waitForTimeout(500);

      const printBtn2 = page.locator('button').filter({ hasText: '인쇄 레이아웃' });
      if (await printBtn2.isVisible({ timeout: 2000 }).catch(() => false)) {
        const downloadPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
        await printBtn2.click();
        const download = await downloadPromise;
        if (download) {
          const downloadPath = path.join(SCREENSHOT_DIR, 'loop8-print-export-admin.png');
          await download.saveAs(downloadPath);
          const stat = fs.statSync(downloadPath);
          log(`Print export (admin): ${stat.size} bytes - should contain watermark with "admin (관리자)"`);
        } else {
          log('Print export (admin): download event not captured');
        }
      }
    }

    // Clean up editor test user
    if (editorUserId && adminToken) {
      await apiDeleteUser(page, adminToken, editorUserId);
      log(`Cleaned up editor test user (id=${editorUserId})`);
    }

    // Logout admin
    await browserLogout(page);
    await screenshot(page, '12-after-logout');
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
  await screenshot(page, '13-mobile-initial');

  const legendOnMobile = await page.locator('text=범례').first().isVisible({ timeout: 2000 }).catch(() => false);
  log(`Legend on mobile: ${legendOnMobile}`);

  const menuBtn = page.locator('button[aria-label="메뉴 토글"]');
  if (await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await menuBtn.click();
    await page.waitForTimeout(500);
    await screenshot(page, '14-mobile-sidebar');
    log('Mobile sidebar: works');
  }

  await context.close();
}

async function main() {
  log(`QA Start: ${new Date().toISOString()}`);

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
    path.join(SCREENSHOT_DIR, 'qa-loop8-results.txt'),
    RESULTS.join('\n') + '\n'
  );
  console.log('\n=== Results ===');
  console.log(RESULTS.join('\n'));
}

main().catch(console.error);
