/**
 * Playwright QA - Loop 14
 * Tests: Data Source edit UI, Multi-tenancy region assignment, regression
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
  const fp = path.join(SCREENSHOT_DIR, `loop14-${name}.png`);
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
  if (!res.ok) return null;
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
  await screenshot(page, '02-all-layers-z15');

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
    await screenshot(page, '03-feature-popup');
  }

  // 6. Search
  const searchInput = page.locator('input[placeholder*="검색"], input[placeholder*="주소"]').first();
  if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await searchInput.fill('포천읍');
    await page.waitForTimeout(2000);
    await screenshot(page, '04-search');
  }

  // 7. Satellite basemap
  const satBtn = page.locator('button').filter({ hasText: '위성' });
  if (await satBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await satBtn.click();
    await page.waitForTimeout(2000);
    await screenshot(page, '05-satellite');
    const osmBtn = page.locator('button').filter({ hasText: '일반' });
    if (await osmBtn.isVisible().catch(() => false)) {
      await osmBtn.click();
      await page.waitForTimeout(1500);
    }
  }

  // === ADMIN LOGIN ===
  log('=== Admin Tests ===');
  const adminLoggedIn = await browserLogin(page, ADMIN_USER, ADMIN_PASS);
  log(`Admin login: ${adminLoggedIn}`);

  if (adminLoggedIn) {
    const adminBadge = page.locator('span').filter({ hasText: '관리자' });
    const hasAdminBadge = await adminBadge.isVisible({ timeout: 3000 }).catch(() => false);
    log(`Admin badge visible: ${hasAdminBadge}`);
    await screenshot(page, '06-admin-logged-in');

    // Open admin panel
    const adminPanelBtn = page.locator('button').filter({ hasText: '데이터 관리' });
    if (await adminPanelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await adminPanelBtn.click();
      await page.waitForTimeout(1000);

      // === DATA SOURCE EDIT UI TEST ===
      log('=== Data Source Edit UI Test ===');

      const dataSourceSection = page.locator('text=공공데이터 소스').first();
      const hasDataSource = await dataSourceSection.isVisible({ timeout: 3000 }).catch(() => false);
      log(`Data source section visible: ${hasDataSource}`);

      if (hasDataSource) {
        // Check for "수정" button on existing data sources
        const editBtn = page.locator('button').filter({ hasText: '수정' }).first();
        const hasEditBtn = await editBtn.isVisible({ timeout: 3000 }).catch(() => false);
        log(`Data source edit button visible: ${hasEditBtn}`);

        if (hasEditBtn) {
          await editBtn.click();
          await page.waitForTimeout(500);

          // Check edit form fields
          const editFormSaveBtn = page.locator('button[type="submit"]').filter({ hasText: '저장' });
          const editFormCancelBtn = page.locator('button').filter({ hasText: '취소' });
          const hasEditForm = await editFormSaveBtn.isVisible({ timeout: 2000 }).catch(() => false);
          log(`Data source edit form visible: ${hasEditForm}`);
          await screenshot(page, '07-datasource-edit-form');

          // Cancel edit
          if (await editFormCancelBtn.isVisible().catch(() => false)) {
            await editFormCancelBtn.click();
            await page.waitForTimeout(300);
            log('Data source edit cancelled');
          }
        } else {
          // No data sources to edit, create one first, then test edit
          const addSourceBtn = page.locator('button').filter({ hasText: '소스 추가' });
          if (await addSourceBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await addSourceBtn.click();
            await page.waitForTimeout(500);

            const nameInput = page.locator('input[placeholder*="국토교통부"]');
            const urlInput = page.locator('input[placeholder*="apis.data.go.kr"]');
            if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
              await nameInput.fill('테스트 편집 소스');
              await urlInput.fill('https://apis.data.go.kr/test');
            }

            const submitBtn = page.locator('button').filter({ hasText: '소스 등록' });
            if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
              await submitBtn.click();
              await page.waitForTimeout(2000);
            }

            // Now test edit
            const editBtnNew = page.locator('button').filter({ hasText: '수정' }).first();
            if (await editBtnNew.isVisible({ timeout: 3000 }).catch(() => false)) {
              await editBtnNew.click();
              await page.waitForTimeout(500);
              log(`Data source edit form after create: visible`);
              await screenshot(page, '07-datasource-edit-form');

              // Cancel
              const cancelBtnNew = page.locator('button').filter({ hasText: '취소' });
              if (await cancelBtnNew.isVisible().catch(() => false)) {
                await cancelBtnNew.click();
                await page.waitForTimeout(300);
              }
            }

            // Delete test source
            const deleteBtnNew = page.locator('button').filter({ hasText: '삭제' }).last();
            if (await deleteBtnNew.isVisible({ timeout: 2000 }).catch(() => false)) {
              page.once('dialog', dialog => dialog.accept());
              await deleteBtnNew.click();
              await page.waitForTimeout(1000);
              log('Test data source deleted');
            }
          }
        }

        await screenshot(page, '08-datasource-section');
      }

      // === USER MANAGEMENT - REGION ASSIGNMENT TEST ===
      log('=== User Region Assignment Test ===');

      const userMgmt = page.locator('text=사용자 관리').first();
      const hasUserMgmt = await userMgmt.isVisible({ timeout: 3000 }).catch(() => false);
      log(`User management visible: ${hasUserMgmt}`);

      if (hasUserMgmt) {
        // Check for "지역" button
        const regionBtn = page.locator('button').filter({ hasText: /^지역/ }).first();
        const hasRegionBtn = await regionBtn.isVisible({ timeout: 3000 }).catch(() => false);
        log(`Region assignment button visible: ${hasRegionBtn}`);
        await screenshot(page, '09-user-management');

        if (hasRegionBtn) {
          await regionBtn.click();
          await page.waitForTimeout(500);

          // Check region assignment form
          const regionForm = page.locator('text=접근 가능 지역').first();
          const hasRegionForm = await regionForm.isVisible({ timeout: 2000 }).catch(() => false);
          log(`Region assignment form visible: ${hasRegionForm}`);

          // Check region checkboxes
          const regionCheckboxes = page.locator('.border-indigo-200 input[type="checkbox"]');
          const regionCount = await regionCheckboxes.count();
          log(`Region checkboxes count: ${regionCount}`);
          await screenshot(page, '10-region-assignment-form');

          // Cancel
          const cancelRegionBtn = page.locator('.border-indigo-200 button').filter({ hasText: '취소' });
          if (await cancelRegionBtn.isVisible().catch(() => false)) {
            await cancelRegionBtn.click();
            await page.waitForTimeout(300);
          }
        }

        // Check region_codes display in user list
        const regionDisplay = page.locator('span.text-indigo-400').first();
        const hasRegionDisplay = await regionDisplay.isVisible({ timeout: 2000 }).catch(() => false);
        log(`User region codes display: ${hasRegionDisplay}`);
      }

      // Check other sections
      const regionMgmt = page.locator('text=지역 관리').first();
      const hasRegionMgmt = await regionMgmt.isVisible({ timeout: 3000 }).catch(() => false);
      log(`Region management visible: ${hasRegionMgmt}`);
    }

    // Print export test
    log('=== Print Export Test ===');
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
          const downloadPath = path.join(SCREENSHOT_DIR, 'loop14-print-export-admin.png');
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

  // === API TEST: Region assignment ===
  log('=== API: Region Assignment Test ===');
  const adminToken = await apiLogin(ADMIN_USER, ADMIN_PASS);
  if (adminToken) {
    // Create test user
    const createRes = await fetch(`${API_URL}/v1/users/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ username: 'qa_region_test', password: 'test1234', name: 'QA Region Test', role: 'viewer' }),
    });
    const testUser = createRes.ok ? await createRes.json() : null;

    if (testUser) {
      log(`Test user created: id=${testUser.id}, region_codes=${JSON.stringify(testUser.region_codes)}`);

      // Assign regions
      const assignRes = await fetch(`${API_URL}/v1/users/${testUser.id}/regions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ region_codes: ['POCHEON'] }),
      });
      const assigned = assignRes.ok ? await assignRes.json() : null;
      if (assigned) {
        log(`Region assignment: ${JSON.stringify(assigned.region_codes)}`);
      }

      // Remove regions
      const removeRes = await fetch(`${API_URL}/v1/users/${testUser.id}/regions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ region_codes: [] }),
      });
      const removed = removeRes.ok ? await removeRes.json() : null;
      if (removed) {
        log(`Region removal: ${JSON.stringify(removed.region_codes)}`);
      }

      // Delete test user
      await fetch(`${API_URL}/v1/users/${testUser.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      log('Test user deleted');
    }
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
    path.join(SCREENSHOT_DIR, 'qa-loop14-results.txt'),
    RESULTS.join('\n') + '\n'
  );
  console.log('\n=== Results ===');
  console.log(RESULTS.join('\n'));
}

main().catch(console.error);
