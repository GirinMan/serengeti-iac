/**
 * Playwright QA - Loop 9
 * Tests: Region Management UI, non-auth watermark, editor file upload e2e, regression
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
  const fp = path.join(SCREENSHOT_DIR, `loop9-${name}.png`);
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

  // 2. Enable all layers
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

  // 4. Legend
  const legendContent = await page.evaluate(() => {
    const el = document.querySelector('.absolute.right-3.bottom-8');
    return el ? el.textContent : null;
  });
  if (legendContent) {
    const subTypes = ['하수관로', '우수관로', '합류관로', '하수맨홀', '우수맨홀', '처리관로', '우수받이'];
    const found = subTypes.filter(t => legendContent.includes(t));
    log(`Legend sub-categories: ${found.join(', ')}`);
  }

  // 5. Feature popup
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

  // === NON-AUTH WATERMARK TEST ===
  log('=== Non-Auth Watermark Test ===');
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
        const downloadPath = path.join(SCREENSHOT_DIR, 'loop9-print-export-noauth.png');
        await download.saveAs(downloadPath);
        const stat = fs.statSync(downloadPath);
        log(`Print export (no auth): ${stat.size} bytes - should contain "비인증 사용자" watermark`);
      } else {
        log('Print export (no auth): download event not captured');
      }
    }
  }
  await screenshot(page, '07-noauth-export');

  // === EDITOR ROLE + FILE UPLOAD E2E TEST ===
  log('=== Editor Role + File Upload Test ===');

  const adminToken = await apiLogin(page, ADMIN_USER, ADMIN_PASS);
  const editorUsername = `qaed_${Date.now() % 100000}`;
  const editorPass = 'test1234';
  let editorUserId = null;

  if (adminToken) {
    const createRes = await apiCreateUser(page, adminToken, {
      username: editorUsername,
      password: editorPass,
      name: 'QA Editor Loop9',
      role: 'editor',
    });

    if (createRes) {
      editorUserId = createRes.id;
      log(`Created editor test user: ${editorUsername} (id=${editorUserId})`);

      const loggedIn = await browserLogin(page, editorUsername, editorPass);
      log(`Editor login: ${loggedIn}`);

      if (loggedIn) {
        await page.waitForTimeout(1000);

        const editorBadge = page.locator('span').filter({ hasText: '편집자' });
        const hasBadge = await editorBadge.isVisible({ timeout: 3000 }).catch(() => false);
        log(`Editor role badge visible: ${hasBadge}`);

        await screenshot(page, '08-editor-logged-in');

        // Open admin panel
        const adminPanelBtn = page.locator('button').filter({ hasText: '데이터 관리' });
        const adminPanelVisible = await adminPanelBtn.isVisible({ timeout: 3000 }).catch(() => false);
        log(`Admin panel visible for editor: ${adminPanelVisible}`);

        if (adminPanelVisible) {
          await adminPanelBtn.click();
          await page.waitForTimeout(500);

          // File upload e2e - create a small GeoJSON test file
          const geojsonData = JSON.stringify({
            type: "FeatureCollection",
            features: [{
              type: "Feature",
              geometry: { type: "Point", coordinates: [127.27, 37.97] },
              properties: { name: "QA Test Point", type: "MANHOLE_SEW" }
            }]
          });

          // Write temp file
          const tempFile = path.join(SCREENSHOT_DIR, 'test-upload.geojson');
          fs.writeFileSync(tempFile, geojsonData);

          // Select facility target table
          const tableSelect = page.locator('select').filter({ has: page.locator('option[value="facilities"]') }).first();
          if (await tableSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
            await tableSelect.selectOption('facilities');
            await page.waitForTimeout(500);
          }

          // Select facility type
          const typeSelect = page.locator('select').filter({ has: page.locator('option[value="MANHOLE_SEW"]') }).first();
          if (await typeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
            await typeSelect.selectOption('MANHOLE_SEW');
          }

          // Upload file
          const fileInput = page.locator('input[type="file"]').first();
          if (await fileInput.count() > 0) {
            await fileInput.setInputFiles(tempFile);
            await page.waitForTimeout(500);

            const uploadBtn = page.locator('button[type="submit"]').filter({ hasText: '업로드' });
            if (await uploadBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
              await uploadBtn.click();
              await page.waitForTimeout(3000);

              // Check result
              const resultMsg = await page.locator('.bg-green-50, .bg-red-50').first().textContent().catch(() => null);
              log(`Upload result: ${resultMsg ?? 'no result message'}`);
            }
          }

          await screenshot(page, '09-editor-file-upload');

          // Check user management NOT visible
          const userMgmt = page.locator('text=사용자 관리').first();
          const hasUserMgmt = await userMgmt.isVisible({ timeout: 2000 }).catch(() => false);
          log(`User management visible for editor: ${hasUserMgmt} (expected: false)`);

          // Check region management NOT visible (admin only)
          const regionMgmt = page.locator('text=지역 관리').first();
          const hasRegionMgmt = await regionMgmt.isVisible({ timeout: 2000 }).catch(() => false);
          log(`Region management visible for editor: ${hasRegionMgmt} (expected: false)`);

          // Clean up temp file
          fs.unlinkSync(tempFile);
        }

        await browserLogout(page);
        log('Editor logout: success');
      }
    }
  }

  // === ADMIN LOGIN + REGION MANAGEMENT TEST ===
  log('=== Admin Region Management Test ===');
  const adminLoggedIn = await browserLogin(page, ADMIN_USER, ADMIN_PASS);
  log(`Admin login: ${adminLoggedIn}`);

  if (adminLoggedIn) {
    const adminBadge = page.locator('span').filter({ hasText: '관리자' });
    const hasAdminBadge = await adminBadge.isVisible({ timeout: 3000 }).catch(() => false);
    log(`Admin badge visible: ${hasAdminBadge}`);

    await screenshot(page, '10-admin-logged-in');

    const adminPanelBtn = page.locator('button').filter({ hasText: '데이터 관리' });
    if (await adminPanelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await adminPanelBtn.click();
      await page.waitForTimeout(1000);

      // Check region management visible for admin
      const regionMgmt = page.locator('text=지역 관리').first();
      const hasRegionMgmt = await regionMgmt.isVisible({ timeout: 3000 }).catch(() => false);
      log(`Region management visible for admin: ${hasRegionMgmt} (expected: true)`);

      // Check region list is shown
      const regionList = await page.evaluate(() => {
        const items = document.querySelectorAll('.border-t.pt-3 .space-y-1 > div');
        return Array.from(items).map(el => el.textContent?.trim()).filter(Boolean);
      });
      log(`Region list: ${regionList.length > 0 ? regionList.join(', ') : 'empty'}`);

      // Check "+ 지역 추가" button
      const addRegionBtn = page.locator('button').filter({ hasText: '지역 추가' });
      const hasAddBtn = await addRegionBtn.isVisible({ timeout: 2000 }).catch(() => false);
      log(`Add region button visible: ${hasAddBtn}`);

      if (hasAddBtn) {
        await addRegionBtn.click();
        await page.waitForTimeout(500);

        // Check form fields are present
        const codeInput = page.locator('input[placeholder*="SEOUL"]');
        const nameInput = page.locator('input[placeholder*="서울"]');
        const captureBtn = page.locator('button').filter({ hasText: '자동 채우기' });

        const hasCode = await codeInput.isVisible({ timeout: 2000 }).catch(() => false);
        const hasName = await nameInput.isVisible({ timeout: 2000 }).catch(() => false);
        const hasCapture = await captureBtn.isVisible({ timeout: 2000 }).catch(() => false);

        log(`Region form - code input: ${hasCode}, name input: ${hasName}, capture button: ${hasCapture}`);

        // Test auto-capture from map
        if (hasCapture) {
          await captureBtn.click();
          await page.waitForTimeout(500);
          const bboxValue = await page.locator('textarea').first().inputValue().catch(() => '');
          log(`Auto-captured BBOX: ${bboxValue ? 'populated' : 'empty'}`);
        }

        await screenshot(page, '11-region-management-form');

        // Cancel form
        const cancelBtn = page.locator('button').filter({ hasText: '취소' });
        if (await cancelBtn.isVisible().catch(() => false)) {
          await cancelBtn.click();
        }
      }

      // Check user management visible for admin
      const userMgmt = page.locator('text=사용자 관리').first();
      const hasUserMgmt = await userMgmt.isVisible({ timeout: 3000 }).catch(() => false);
      log(`User management visible for admin: ${hasUserMgmt} (expected: true)`);

      await screenshot(page, '12-admin-panel-full');
    }

    // Admin export watermark
    log('=== Admin Watermark Test ===');
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
          const downloadPath = path.join(SCREENSHOT_DIR, 'loop9-print-export-admin.png');
          await download.saveAs(downloadPath);
          const stat = fs.statSync(downloadPath);
          log(`Print export (admin): ${stat.size} bytes - should contain admin watermark`);
        }
      }
    }

    // Clean up test editor user
    if (editorUserId && adminToken) {
      await apiDeleteUser(page, adminToken, editorUserId);
      log(`Cleaned up editor test user (id=${editorUserId})`);
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
    path.join(SCREENSHOT_DIR, 'qa-loop9-results.txt'),
    RESULTS.join('\n') + '\n'
  );
  console.log('\n=== Results ===');
  console.log(RESULTS.join('\n'));
}

main().catch(console.error);
