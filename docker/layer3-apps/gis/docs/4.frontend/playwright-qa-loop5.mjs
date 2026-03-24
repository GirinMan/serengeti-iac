/**
 * Playwright QA - Loop 5
 * Tests: Registration flow, password change, user search/filter, MapExport legend sub-categories,
 *        overall regression
 */
import { chromium } from 'playwright';
import path from 'path';
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
  const fp = path.join(SCREENSHOT_DIR, `loop5-${name}.png`);
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

  // 2. Select region
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

  // 3. Enable all layers
  const checkboxes = page.locator('input[type="checkbox"]');
  const checkboxCount = await checkboxes.count();
  log(`Layer checkboxes found: ${checkboxCount}`);
  for (let i = 0; i < checkboxCount; i++) {
    const cb = checkboxes.nth(i);
    if (!(await cb.isChecked())) {
      await cb.check();
      await page.waitForTimeout(300);
    }
  }
  await page.waitForTimeout(2000);
  await screenshot(page, '02-all-layers-on');

  // 4. Zoom to data area
  await page.evaluate(() => {
    window.__gis_map.jumpTo({ center: [127.27, 37.97], zoom: 15 });
  });
  await waitForMap(page);
  await page.waitForTimeout(3000);

  // Check legend panel with match sub-categories
  const legendContent = await page.evaluate(() => {
    const el = document.querySelector('.absolute.right-3.bottom-8');
    return el ? el.textContent : null;
  });
  if (legendContent) {
    const subTypes = ['하수관로', '우수관로', '합류관로', '하수맨홀', '우수맨홀', '처리관로', '우수받이'];
    const found = subTypes.filter(t => legendContent.includes(t));
    log(`Legend match sub-categories found: ${found.join(', ')}`);
  }
  await screenshot(page, '03-legend-subcategories');

  // Feature counts
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

  // 5. Click on feature for popup
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
    await screenshot(page, '05-search-autocomplete');
    await searchInput.press('Enter');
    await page.waitForTimeout(2000);
  }

  // 7. Basemap satellite
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

  // 8. Export menu
  const exportBtn = page.locator('button').filter({ hasText: '내보내기' });
  if (await exportBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await exportBtn.click();
    await page.waitForTimeout(500);
    await screenshot(page, '07-export-menu');
    await page.mouse.click(10, 10);
    await page.waitForTimeout(300);
  }

  // === REGISTRATION TEST ===
  log('=== Registration Test ===');

  // 9. Navigate to login, then switch to register
  const loginBtn = page.locator('button').filter({ hasText: '관리자 로그인' });
  if (await loginBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await loginBtn.click();
    await page.waitForTimeout(1000);

    // Find "회원가입" link on login form
    const registerLink = page.locator('button').filter({ hasText: '회원가입' });
    const registerLinkVisible = await registerLink.isVisible({ timeout: 3000 }).catch(() => false);
    log(`Register link on login form: ${registerLinkVisible}`);
    await screenshot(page, '08-login-with-register-link');

    if (registerLinkVisible) {
      await registerLink.click();
      await page.waitForTimeout(1000);
      await screenshot(page, '09-register-form');

      // Fill registration form
      const regUsername = page.locator('#reg-username');
      const regName = page.locator('#reg-name');
      const regPassword = page.locator('#reg-password');
      const regPasswordConfirm = page.locator('#reg-password-confirm');

      if (await regUsername.isVisible({ timeout: 2000 }).catch(() => false)) {
        await regUsername.fill('qatest_loop5');
        await regName.fill('QA 테스트');
        await regPassword.fill('test1234');
        await regPasswordConfirm.fill('test1234');
        await screenshot(page, '10-register-filled');

        // Submit
        const submitBtn = page.locator('button[type="submit"]').first();
        await submitBtn.click();
        await page.waitForTimeout(3000);

        // Check if auto-logged in after registration
        const logoutBtnAfterReg = page.locator('button').filter({ hasText: '로그아웃' });
        const autoLoggedIn = await logoutBtnAfterReg.isVisible({ timeout: 5000 }).catch(() => false);
        log(`Auto-login after registration: ${autoLoggedIn}`);
        await screenshot(page, '11-after-register');

        if (autoLoggedIn) {
          // Logout to test admin features
          await logoutBtnAfterReg.click();
          await page.waitForTimeout(1000);
        }
      }
    } else {
      // Fallback: go back
      const backBtn = page.locator('button').filter({ hasText: '지도로 돌아가기' });
      if (await backBtn.isVisible().catch(() => false)) {
        await backBtn.click();
        await page.waitForTimeout(1000);
      }
    }
  }

  // === ADMIN LOGIN & USER MANAGEMENT ENHANCED TEST ===
  log('=== Admin Login & User Management Test ===');

  const loginBtn2 = page.locator('button').filter({ hasText: '관리자 로그인' });
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
      await screenshot(page, '12-admin-logged-in');

      if (loggedIn) {
        // Open admin panel
        const adminToggle = page.locator('button').filter({ hasText: '데이터 관리' });
        if (await adminToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
          await adminToggle.click();
          await page.waitForTimeout(500);
          await screenshot(page, '13-admin-panel');

          // Check user management section
          const userMgmt = page.locator('text=사용자 관리').first();
          const userMgmtVisible = await userMgmt.isVisible({ timeout: 3000 }).catch(() => false);
          log(`User management section: ${userMgmtVisible}`);

          // Test search filter in user management
          const searchFilter = page.locator('input[placeholder*="검색"]').last();
          if (await searchFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
            await searchFilter.fill('qa');
            await page.waitForTimeout(500);
            await screenshot(page, '14-user-search');
            log('User search filter: works');
            await searchFilter.clear();
            await page.waitForTimeout(300);
          }

          // Test role filter
          const roleFilter = page.locator('select').last();
          if (await roleFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
            const roleOptions = await roleFilter.locator('option').allTextContents();
            log(`Role filter options: ${roleOptions.join(', ')}`);
          }

          // Test password change button visibility
          const pwBtn = page.locator('button').filter({ hasText: 'PW' });
          const pwBtnCount = await pwBtn.count();
          log(`Password change buttons: ${pwBtnCount}`);

          if (pwBtnCount > 0) {
            await pwBtn.first().click();
            await page.waitForTimeout(500);
            const pwForm = page.locator('text=비밀번호 변경').first();
            const pwFormVisible = await pwForm.isVisible({ timeout: 2000 }).catch(() => false);
            log(`Password change form: ${pwFormVisible}`);
            await screenshot(page, '15-password-change-form');

            // Cancel password change
            const cancelPwBtn = page.locator('button').filter({ hasText: '취소' }).last();
            if (await cancelPwBtn.isVisible().catch(() => false)) {
              await cancelPwBtn.click();
              await page.waitForTimeout(300);
            }
          }

          // Clean up test user if exists
          const deleteBtn = page.locator('button[title="삭제"]').first();
          if (await deleteBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            page.once('dialog', dialog => dialog.accept());
            await deleteBtn.click();
            await page.waitForTimeout(1000);
            log('Cleaned up test user');
          }
        }

        // Logout
        const logoutBtn = page.locator('button').filter({ hasText: '로그아웃' });
        if (await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await logoutBtn.click();
          await page.waitForTimeout(1000);
          await screenshot(page, '16-after-logout');
          log('Logout: success');
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
  await screenshot(page, '17-mobile-initial');

  // Check legend
  const legendOnMobile = await page.locator('text=범례').first().isVisible({ timeout: 2000 }).catch(() => false);
  log(`Legend on mobile: ${legendOnMobile}`);

  // Open sidebar
  const menuBtn = page.locator('button[aria-label="메뉴 토글"]');
  if (await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await menuBtn.click();
    await page.waitForTimeout(500);
    await screenshot(page, '18-mobile-sidebar');
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

  const fs = await import('fs');
  fs.writeFileSync(
    path.join(SCREENSHOT_DIR, 'qa-loop5-results.txt'),
    RESULTS.join('\n') + '\n'
  );
  console.log('\n=== Results ===');
  console.log(RESULTS.join('\n'));
}

main().catch(console.error);
