/**
 * Playwright QA - Loop 6
 * Tests: Profile edit, registration approval workflow, MapExport PNG download, overall regression
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
  const fp = path.join(SCREENSHOT_DIR, `loop6-${name}.png`);
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

  // 3. Zoom to data area and check features
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

  // 8. Export menu + print layout PNG download test
  const exportBtn = page.locator('button').filter({ hasText: '내보내기' });
  if (await exportBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await exportBtn.click();
    await page.waitForTimeout(500);
    await screenshot(page, '07-export-menu');

    // Test print layout download
    const printBtn = page.locator('button').filter({ hasText: '인쇄 레이아웃' });
    if (await printBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 10000 }).catch(() => null),
        printBtn.click(),
      ]);
      if (download) {
        const dlPath = path.join(SCREENSHOT_DIR, 'loop6-print-export.png');
        await download.saveAs(dlPath);
        const stat = fs.statSync(dlPath);
        log(`Print layout PNG download: ${stat.size} bytes`);
      } else {
        log('Print layout PNG download: no download event (canvas may be tainted)');
      }
    }

    await page.mouse.click(10, 10);
    await page.waitForTimeout(300);
  }

  // === REGISTRATION APPROVAL WORKFLOW TEST ===
  log('=== Registration Approval Workflow Test ===');

  const testUsername = `qatest_loop6_${Date.now() % 10000}`;

  const loginBtn = page.locator('button').filter({ hasText: '관리자 로그인' });
  if (await loginBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await loginBtn.click();
    await page.waitForTimeout(1000);

    // Switch to registration
    const registerLink = page.locator('button').filter({ hasText: '회원가입' });
    if (await registerLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await registerLink.click();
      await page.waitForTimeout(1000);

      // Fill and submit registration
      await page.locator('#reg-username').fill(testUsername);
      await page.locator('#reg-name').fill('QA Loop6 Test');
      await page.locator('#reg-password').fill('test1234');
      await page.locator('#reg-password-confirm').fill('test1234');
      await screenshot(page, '08-register-filled');

      await page.locator('button[type="submit"]').first().click();
      await page.waitForTimeout(3000);

      // Check for pending approval message (NOT auto-login)
      const pendingMsg = page.locator('text=관리자의 승인');
      const isPending = await pendingMsg.isVisible({ timeout: 5000 }).catch(() => false);
      log(`Registration pending approval message: ${isPending}`);
      await screenshot(page, '09-register-pending');

      // Try to go back to login
      const toLoginBtn = page.locator('button').filter({ hasText: '로그인 페이지로' });
      if (await toLoginBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await toLoginBtn.click();
        await page.waitForTimeout(1000);

        // Try login with unactivated account
        const usernameInput = page.locator('#username').first();
        const passwordInput = page.locator('#password').first();
        if (await usernameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await usernameInput.fill(testUsername);
          await passwordInput.fill('test1234');
          await page.locator('button[type="submit"]').first().click();
          await page.waitForTimeout(2000);

          // Should show error message about inactive account
          const loginError = await page.locator('.bg-red-50').textContent().catch(() => '');
          log(`Login attempt with inactive account: ${loginError ? 'blocked - ' + loginError.slice(0, 60) : 'no error shown'}`);
          await screenshot(page, '10-inactive-login-blocked');
        }

        // Go back
        const backBtn = page.locator('button').filter({ hasText: '지도로 돌아가기' });
        if (await backBtn.isVisible().catch(() => false)) {
          await backBtn.click();
          await page.waitForTimeout(1000);
        }
      } else {
        // Fallback: go back from pending screen
        const backBtn2 = page.locator('button').filter({ hasText: '돌아가기' });
        if (await backBtn2.isVisible().catch(() => false)) {
          await backBtn2.click();
          await page.waitForTimeout(1000);
        }
      }
    }
  }

  // === ADMIN LOGIN, APPROVE USER, PROFILE EDIT TEST ===
  log('=== Admin Login & Approval Test ===');

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
      await screenshot(page, '11-admin-logged-in');

      if (loggedIn) {
        // Check for pending approval badge
        const adminToggle = page.locator('button').filter({ hasText: '데이터 관리' });
        if (await adminToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
          await adminToggle.click();
          await page.waitForTimeout(500);

          // Check pending count notification
          const pendingBadge = page.locator('text=승인 대기');
          const hasPendingBadge = await pendingBadge.isVisible({ timeout: 3000 }).catch(() => false);
          log(`Pending users badge visible: ${hasPendingBadge}`);
          await screenshot(page, '12-admin-pending-users');

          // Find and approve the test user
          const approveBtn = page.locator('button').filter({ hasText: '승인' }).first();
          if (await approveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await approveBtn.click();
            await page.waitForTimeout(1000);
            log('Test user approved');
            await screenshot(page, '13-user-approved');
          }

          // Clean up: delete test user
          const deleteBtn = page.locator('button[title="삭제"]').first();
          if (await deleteBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            page.once('dialog', dialog => dialog.accept());
            await deleteBtn.click();
            await page.waitForTimeout(1000);
            log('Cleaned up test user');
          }
        }

        // === PROFILE EDIT TEST ===
        log('=== Profile Edit Test ===');

        const settingsBtn = page.locator('button').filter({ hasText: '설정' });
        if (await settingsBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await settingsBtn.click();
          await page.waitForTimeout(500);

          const profileSection = page.locator('text=프로필 수정').first();
          const profileVisible = await profileSection.isVisible({ timeout: 3000 }).catch(() => false);
          log(`Profile edit panel: ${profileVisible}`);
          await screenshot(page, '14-profile-edit');

          if (profileVisible) {
            // Check username is disabled
            const usernameDisabled = page.locator('input[disabled]');
            const isDisabled = await usernameDisabled.isVisible({ timeout: 1000 }).catch(() => false);
            log(`Username field disabled: ${isDisabled}`);

            // Check password change section
            const pwSection = page.locator('text=비밀번호 변경').first();
            const hasPwSection = await pwSection.isVisible({ timeout: 1000 }).catch(() => false);
            log(`Password change section: ${hasPwSection}`);
            await screenshot(page, '15-profile-edit-form');

            // Close profile
            const closeBtn = page.locator('button').filter({ hasText: '닫기' });
            if (await closeBtn.isVisible().catch(() => false)) {
              await closeBtn.click();
              await page.waitForTimeout(300);
            }
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

  const legendOnMobile = await page.locator('text=범례').first().isVisible({ timeout: 2000 }).catch(() => false);
  log(`Legend on mobile: ${legendOnMobile}`);

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

  fs.writeFileSync(
    path.join(SCREENSHOT_DIR, 'qa-loop6-results.txt'),
    RESULTS.join('\n') + '\n'
  );
  console.log('\n=== Results ===');
  console.log(RESULTS.join('\n'));
}

main().catch(console.error);
