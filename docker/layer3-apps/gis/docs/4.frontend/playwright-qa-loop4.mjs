/**
 * Playwright QA - Loop 4
 * Tests: Admin authentication (real login), user management, legend match sub-categories,
 *        legacy feature parity check, overall regression
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
  const fp = path.join(SCREENSHOT_DIR, `loop4-${name}.png`);
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

  // 4. Zoom to data area and check legend with match sub-categories
  await page.evaluate(() => {
    window.__gis_map.jumpTo({ center: [127.27, 37.97], zoom: 15 });
  });
  await waitForMap(page);
  await page.waitForTimeout(3000);

  // Check legend panel content
  const legendPanel = page.locator('text=범례').first();
  const legendVisible = await legendPanel.isVisible({ timeout: 3000 }).catch(() => false);
  log(`Legend panel visible: ${legendVisible}`);

  // Check for match sub-categories in legend
  const legendContent = await page.evaluate(() => {
    const el = document.querySelector('.absolute.right-3.bottom-8');
    return el ? el.textContent : null;
  });
  if (legendContent) {
    const hasSubCategories = ['하수관로', '우수관로', '합류관로', '하수맨홀', '우수맨홀'].some(t => legendContent.includes(t));
    log(`Legend match sub-categories: ${hasSubCategories ? 'SHOWING' : 'NOT FOUND'}`);
    log(`Legend content: ${legendContent.substring(0, 200)}`);
  }
  await screenshot(page, '03-legend-subcategories');

  // Feature counts
  const featureCounts = await page.evaluate(() => {
    const m = window.__gis_map;
    const layers = m.getStyle().layers.filter(l => l.id.startsWith('lyr-'));
    const results = {};
    for (const l of layers) {
      try {
        results[l.id] = m.queryRenderedFeatures(undefined, { layers: [l.id] }).length;
      } catch { results[l.id] = 0; }
    }
    return results;
  });
  log(`Feature counts at z15: ${JSON.stringify(featureCounts)}`);

  // 5. Click on map feature to test popup with type badge
  const mapCanvas = page.locator('.maplibregl-canvas, canvas').first();
  const mapBox = await mapCanvas.boundingBox();
  if (mapBox) {
    await page.mouse.click(mapBox.x + mapBox.width / 2, mapBox.y + mapBox.height / 2);
    await page.waitForTimeout(2000);
    await screenshot(page, '04-feature-popup');

    const popup = page.locator('.maplibregl-popup');
    const popupVisible = await popup.isVisible({ timeout: 3000 }).catch(() => false);
    log(`Feature popup visible: ${popupVisible}`);
    if (popupVisible) {
      const popupContent = await popup.textContent().catch(() => '');
      log(`Popup content: ${popupContent.substring(0, 150)}`);
    }
  }

  // 6. Test search functionality (legacy parity: address search)
  const searchInput = page.locator('input[placeholder*="검색"], input[placeholder*="주소"]').first();
  if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await searchInput.fill('포천읍');
    await page.waitForTimeout(2000);
    const autoResults = page.locator('.absolute.top-full');
    const autoVisible = await autoResults.isVisible({ timeout: 2000 }).catch(() => false);
    log(`Search autocomplete visible: ${autoVisible}`);
    await screenshot(page, '05-search-autocomplete');

    // Enter search
    await searchInput.press('Enter');
    await page.waitForTimeout(2000);
    await screenshot(page, '06-search-results');
  }

  // 7. Test measure tool (legacy parity)
  const measureBtn = page.locator('button').filter({ hasText: '측정' });
  if (await measureBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await measureBtn.click();
    await page.waitForTimeout(500);
    await screenshot(page, '07-measure-tool');
    log('Measure tool: accessible');
    // Click again to close
    await measureBtn.click();
    await page.waitForTimeout(300);
  }

  // 8. Test map export (legacy parity: print)
  const exportBtn = page.locator('button').filter({ hasText: '내보내기' });
  if (await exportBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await exportBtn.click();
    await page.waitForTimeout(500);
    await screenshot(page, '08-export-menu');
    log('Export menu: accessible');
    // Close by clicking away
    await page.mouse.click(10, 10);
    await page.waitForTimeout(300);
  }

  // 9. Test basemap switching
  const satBtn = page.locator('button').filter({ hasText: '위성' });
  if (await satBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await satBtn.click();
    await page.waitForTimeout(2000);
    await screenshot(page, '09-satellite');
    log('Basemap satellite: works');
    const osmBtn = page.locator('button').filter({ hasText: '일반' });
    if (await osmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await osmBtn.click();
      await page.waitForTimeout(1500);
    }
  }

  // === ADMIN AUTHENTICATION TEST ===
  log('=== Admin Authentication Test ===');

  // 10. Click login button
  const loginBtn = page.locator('button').filter({ hasText: '관리자 로그인' });
  if (await loginBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await loginBtn.click();
    await page.waitForTimeout(1000);
    await screenshot(page, '10-login-form');

    // 11. Login with real admin credentials
    const usernameInput = page.locator('#username').first();
    const passwordInput = page.locator('#password').first();
    if (await usernameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await usernameInput.fill(ADMIN_USER);
      await passwordInput.fill(ADMIN_PASS);
      const submitBtn = page.locator('button[type="submit"]').first();
      await submitBtn.click();
      await page.waitForTimeout(3000);

      // Check if logged in (should redirect to map with user menu)
      const userMenu = page.locator('text=로그아웃');
      const loggedIn = await userMenu.isVisible({ timeout: 5000 }).catch(() => false);
      log(`Admin login success: ${loggedIn}`);
      await screenshot(page, '11-admin-logged-in');

      if (loggedIn) {
        // 12. Check admin panel is visible
        const adminToggle = page.locator('button').filter({ hasText: '데이터 관리' });
        if (await adminToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
          await adminToggle.click();
          await page.waitForTimeout(500);
          await screenshot(page, '12-admin-panel-open');
          log('Admin panel opened: works');

          // 13. Check user management section
          const userMgmt = page.locator('text=사용자 관리').first();
          const userMgmtVisible = await userMgmt.isVisible({ timeout: 3000 }).catch(() => false);
          log(`User management section: ${userMgmtVisible ? 'visible' : 'not visible'}`);
          await screenshot(page, '13-user-management');

          // 14. Check data upload section
          const uploadSection = page.locator('text=파일 업로드').first();
          const uploadVisible = await uploadSection.isVisible({ timeout: 2000 }).catch(() => false);
          log(`Data upload section: ${uploadVisible ? 'visible' : 'not visible'}`);

          // 15. Check import history section
          const historySection = page.locator('text=수집 이력').first();
          const historyVisible = await historySection.isVisible({ timeout: 2000 }).catch(() => false);
          log(`Import history section: ${historyVisible ? 'visible' : 'not visible'}`);
        }

        // 16. Check user info display
        const userName = page.locator('text=관리자').first();
        const userNameVisible = await userName.isVisible({ timeout: 2000 }).catch(() => false);
        log(`User name display: ${userNameVisible ? 'visible' : 'not visible'}`);

        // 17. Logout
        const logoutBtn = page.locator('button').filter({ hasText: '로그아웃' });
        if (await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await logoutBtn.click();
          await page.waitForTimeout(1000);
          const loginBtnAfter = page.locator('button').filter({ hasText: '관리자 로그인' });
          const loggedOut = await loginBtnAfter.isVisible({ timeout: 3000 }).catch(() => false);
          log(`Logout success: ${loggedOut}`);
          await screenshot(page, '14-after-logout');
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
  await screenshot(page, '15-mobile-initial');

  // Check legend
  const mobileLegend = page.locator('text=범례').first();
  const legendOnMobile = await mobileLegend.isVisible({ timeout: 2000 }).catch(() => false);
  log(`Legend on mobile: ${legendOnMobile}`);

  // Open sidebar
  const menuBtn = page.locator('button[aria-label="메뉴 토글"]');
  if (await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await menuBtn.click();
    await page.waitForTimeout(500);
    await screenshot(page, '16-mobile-sidebar');
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
    path.join(SCREENSHOT_DIR, 'qa-loop4-results.txt'),
    RESULTS.join('\n') + '\n'
  );
  console.log('\n=== Results ===');
  console.log(RESULTS.join('\n'));
}

main().catch(console.error);
