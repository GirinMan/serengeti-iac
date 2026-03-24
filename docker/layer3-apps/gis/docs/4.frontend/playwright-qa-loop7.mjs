/**
 * Playwright QA - Loop 7
 * Tests: Role-based UI access control, profile edit e2e, overall regression
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
  const fp = path.join(SCREENSHOT_DIR, `loop7-${name}.png`);
  await page.screenshot({ path: fp, fullPage: false });
  log(`Screenshot: ${name}`);
  return fp;
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

  // 2. Check login button text changed from "관리자 로그인" to "로그인"
  const loginBtn = page.locator('button').filter({ hasText: '로그인' }).last();
  const loginBtnText = await loginBtn.textContent().catch(() => '');
  const isNewLoginText = loginBtnText.trim() === '로그인';
  log(`Login button text: "${loginBtnText.trim()}" (updated to "로그인": ${isNewLoginText})`);

  // 3. Select region & enable all layers
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

  // 4. Zoom to data area and check features
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

  // 5. Legend check
  const legendContent = await page.evaluate(() => {
    const el = document.querySelector('.absolute.right-3.bottom-8');
    return el ? el.textContent : null;
  });
  if (legendContent) {
    const subTypes = ['하수관로', '우수관로', '합류관로', '하수맨홀', '우수맨홀', '처리관로', '우수받이'];
    const found = subTypes.filter(t => legendContent.includes(t));
    log(`Legend sub-categories: ${found.join(', ')}`);
  }

  // 6. Click feature popup
  const mapCanvas = page.locator('.maplibregl-canvas, canvas').first();
  const mapBox = await mapCanvas.boundingBox();
  if (mapBox) {
    await page.mouse.click(mapBox.x + mapBox.width / 2, mapBox.y + mapBox.height / 2);
    await page.waitForTimeout(2000);
    await screenshot(page, '04-feature-popup');
  }

  // 7. Search
  const searchInput = page.locator('input[placeholder*="검색"], input[placeholder*="주소"]').first();
  if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await searchInput.fill('포천읍');
    await page.waitForTimeout(2000);
    await screenshot(page, '05-search');
  }

  // 8. Satellite basemap
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

  // === ROLE-BASED UI ACCESS CONTROL TEST: VIEWER ===
  log('=== Role-Based UI Test: Viewer ===');

  // Create a viewer test user via API
  const viewerUsername = `qav_${Date.now() % 100000}`;
  const viewerPass = 'test1234';

  // First login as admin to create user
  const adminToken = await page.evaluate(async ({ url, user, pass }) => {
    const res = await fetch(`${url}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, password: pass }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token;
  }, { url: SITE_URL, user: ADMIN_USER, pass: ADMIN_PASS });

  let viewerUserId = null;
  if (adminToken) {
    // Create viewer user (active)
    const createRes = await page.evaluate(async ({ url, token, username, password }) => {
      const res = await fetch(`${url}/api/v1/users/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ username, password, name: 'QA Viewer', role: 'viewer' }),
      });
      if (!res.ok) return null;
      return res.json();
    }, { url: SITE_URL, token: adminToken, username: viewerUsername, password: viewerPass });

    if (createRes) {
      viewerUserId = createRes.id;
      log(`Created viewer test user: ${viewerUsername} (id=${viewerUserId})`);

      // Login as viewer
      await loginBtn.click();
      await page.waitForTimeout(1000);

      const usernameInput = page.locator('#username').first();
      const passwordInput = page.locator('#password').first();
      if (await usernameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await usernameInput.fill(viewerUsername);
        await passwordInput.fill(viewerPass);
        await page.locator('button[type="submit"]').first().click();
        await page.waitForTimeout(3000);

        const loggedIn = await page.locator('button').filter({ hasText: '로그아웃' }).isVisible({ timeout: 5000 }).catch(() => false);
        log(`Viewer login: ${loggedIn}`);

        if (loggedIn) {
          // Check role badge in Korean
          const roleBadge = page.locator('span').filter({ hasText: '뷰어' });
          const hasRoleBadge = await roleBadge.isVisible({ timeout: 3000 }).catch(() => false);
          log(`Viewer role badge "뷰어" visible: ${hasRoleBadge}`);

          // Check AdminPanel is NOT visible
          const adminPanelBtn = page.locator('button').filter({ hasText: '데이터 관리' });
          const adminPanelVisible = await adminPanelBtn.isVisible({ timeout: 2000 }).catch(() => false);
          log(`Admin panel visible for viewer: ${adminPanelVisible} (expected: false)`);

          // Check settings button is still visible (all users can edit profile)
          const settingsBtn = page.locator('button').filter({ hasText: '설정' });
          const settingsVisible = await settingsBtn.isVisible({ timeout: 2000 }).catch(() => false);
          log(`Settings button visible for viewer: ${settingsVisible} (expected: true)`);

          await screenshot(page, '07-viewer-logged-in');

          // === PROFILE EDIT E2E TEST (as viewer) ===
          log('=== Profile Edit E2E Test ===');

          if (settingsVisible) {
            await settingsBtn.click();
            await page.waitForTimeout(500);

            const profilePanel = page.locator('text=프로필 수정').first();
            const profileVisible = await profilePanel.isVisible({ timeout: 3000 }).catch(() => false);
            log(`Profile edit panel visible: ${profileVisible}`);

            if (profileVisible) {
              // Test 1: Change name
              const nameInput = page.locator('input[placeholder="표시 이름"]');
              if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                await nameInput.fill('QA Updated Name');
                await page.locator('button').filter({ hasText: '저장' }).first().click();
                await page.waitForTimeout(2000);

                const successMsg = page.locator('text=프로필이 업데이트되었습니다');
                const nameUpdateSuccess = await successMsg.isVisible({ timeout: 3000 }).catch(() => false);
                log(`Name change: ${nameUpdateSuccess ? 'success' : 'failed'}`);
                await screenshot(page, '08-profile-name-changed');

                // Verify name displayed in UserMenu updated
                const displayedName = await page.locator('.truncate.text-sm.font-medium').textContent().catch(() => '');
                log(`Displayed name after change: "${displayedName.trim()}"`);
              }

              // Test 2: Change password
              await page.waitForTimeout(1000);

              const currentPwInput = page.locator('input[placeholder="현재 비밀번호"]');
              const newPwInput = page.locator('input[placeholder*="새 비밀번호"]').first();
              const confirmPwInput = page.locator('input[placeholder="새 비밀번호 확인"]');

              if (await currentPwInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                // Test 2a: Wrong current password
                await currentPwInput.fill('wrongpassword');
                await newPwInput.fill('newpass1234');
                await confirmPwInput.fill('newpass1234');
                await page.locator('button').filter({ hasText: '저장' }).first().click();
                await page.waitForTimeout(2000);

                const errorMsg = page.locator('text=현재 비밀번호가 올바르지 않습니다');
                const wrongPwError = await errorMsg.isVisible({ timeout: 3000 }).catch(() => false);
                log(`Wrong password error: ${wrongPwError}`);
                await screenshot(page, '09-profile-wrong-pw');

                // Test 2b: Correct password change
                await currentPwInput.fill(viewerPass);
                await newPwInput.fill('newpass5678');
                await confirmPwInput.fill('newpass5678');
                await page.locator('button').filter({ hasText: '저장' }).first().click();
                await page.waitForTimeout(2000);

                const pwSuccess = page.locator('text=프로필이 업데이트되었습니다');
                const pwChangeSuccess = await pwSuccess.isVisible({ timeout: 3000 }).catch(() => false);
                log(`Password change: ${pwChangeSuccess ? 'success' : 'failed'}`);
                await screenshot(page, '10-profile-pw-changed');
              }

              // Close profile panel
              const closeBtn = page.locator('button').filter({ hasText: '닫기' });
              if (await closeBtn.isVisible().catch(() => false)) {
                await closeBtn.click();
                await page.waitForTimeout(300);
              }
            }
          }

          // Logout viewer
          const logoutBtn = page.locator('button').filter({ hasText: '로그아웃' });
          if (await logoutBtn.isVisible().catch(() => false)) {
            await logoutBtn.click();
            await page.waitForTimeout(1000);
            log('Viewer logout: success');
          }
        }
      }
    }
  }

  // === ADMIN LOGIN - VERIFY ADMIN ROLE BADGE & PANEL ===
  log('=== Admin Role UI Test ===');

  const loginBtn2 = page.locator('button').filter({ hasText: '로그인' }).last();
  if (await loginBtn2.isVisible({ timeout: 3000 }).catch(() => false)) {
    await loginBtn2.click();
    await page.waitForTimeout(1000);

    const usernameInput = page.locator('#username').first();
    const passwordInput = page.locator('#password').first();
    if (await usernameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await usernameInput.fill(ADMIN_USER);
      await passwordInput.fill(ADMIN_PASS);
      await page.locator('button[type="submit"]').first().click();
      await page.waitForTimeout(3000);

      const loggedIn = await page.locator('button').filter({ hasText: '로그아웃' }).isVisible({ timeout: 5000 }).catch(() => false);
      log(`Admin login: ${loggedIn}`);

      if (loggedIn) {
        // Check admin role badge in Korean
        const adminBadge = page.locator('span').filter({ hasText: '관리자' });
        const hasAdminBadge = await adminBadge.isVisible({ timeout: 3000 }).catch(() => false);
        log(`Admin role badge "관리자" visible: ${hasAdminBadge}`);

        // Check AdminPanel IS visible
        const adminPanelBtn = page.locator('button').filter({ hasText: '데이터 관리' });
        const adminPanelVisible = await adminPanelBtn.isVisible({ timeout: 3000 }).catch(() => false);
        log(`Admin panel visible for admin: ${adminPanelVisible} (expected: true)`);

        await screenshot(page, '11-admin-logged-in');

        // Open admin panel and check user management
        if (adminPanelVisible) {
          await adminPanelBtn.click();
          await page.waitForTimeout(500);
          await screenshot(page, '12-admin-panel-open');

          const userMgmt = page.locator('text=사용자 관리');
          const hasUserMgmt = await userMgmt.isVisible({ timeout: 3000 }).catch(() => false);
          log(`User management visible for admin: ${hasUserMgmt} (expected: true)`);
        }

        // Clean up test viewer user
        if (viewerUserId && adminToken) {
          await page.evaluate(async ({ url, token, userId }) => {
            await fetch(`${url}/api/v1/users/${userId}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` },
            });
          }, { url: SITE_URL, token: adminToken, userId: viewerUserId });
          log(`Cleaned up viewer test user (id=${viewerUserId})`);
        }

        // Logout
        const logoutBtn = page.locator('button').filter({ hasText: '로그아웃' });
        if (await logoutBtn.isVisible().catch(() => false)) {
          await logoutBtn.click();
          await page.waitForTimeout(1000);
          await screenshot(page, '13-after-logout');
          log('Admin logout: success');
        }
      }
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
  await screenshot(page, '14-mobile-initial');

  const legendOnMobile = await page.locator('text=범례').first().isVisible({ timeout: 2000 }).catch(() => false);
  log(`Legend on mobile: ${legendOnMobile}`);

  const menuBtn = page.locator('button[aria-label="메뉴 토글"]');
  if (await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await menuBtn.click();
    await page.waitForTimeout(500);
    await screenshot(page, '15-mobile-sidebar');
    log('Mobile sidebar: works');

    // Check login button text on mobile
    const mobileLoginBtn = page.locator('button').filter({ hasText: '로그인' }).last();
    const mobileLoginText = await mobileLoginBtn.textContent().catch(() => '');
    log(`Mobile login button: "${mobileLoginText.trim()}"`);
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
    path.join(SCREENSHOT_DIR, 'qa-loop7-results.txt'),
    RESULTS.join('\n') + '\n'
  );
  console.log('\n=== Results ===');
  console.log(RESULTS.join('\n'));
}

main().catch(console.error);
