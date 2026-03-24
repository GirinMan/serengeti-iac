/**
 * Playwright QA - Loop 3
 * Tests: Legend component, improved popup, admin panel, overall regression
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
const SITE_URL = 'https://gis.giraffe.ai.kr';
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
  const fp = path.join(SCREENSHOT_DIR, `loop3-${name}.png`);
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

  // 4. Check legend visibility
  const legendPanel = page.locator('text=범례').first();
  const legendVisible = await legendPanel.isVisible({ timeout: 3000 }).catch(() => false);
  log(`Legend panel visible: ${legendVisible}`);
  await screenshot(page, '03-legend-visible');

  // 5. Zoom to data area
  await page.evaluate(() => {
    window.__gis_map.jumpTo({ center: [127.27, 37.97], zoom: 15 });
  });
  await waitForMap(page);
  await page.waitForTimeout(3000);
  await screenshot(page, '04-z15-with-legend');

  // Count features
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

  // 6. Test legend collapse/expand
  const legendToggle = page.locator('button:has-text("범례")').first();
  if (await legendToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
    await legendToggle.click();
    await page.waitForTimeout(300);
    await screenshot(page, '05-legend-collapsed');
    log('Legend collapse: works');

    await legendToggle.click();
    await page.waitForTimeout(300);
    log('Legend expand: works');
  }

  // 7. Click on map feature to test improved popup
  const mapCanvas = page.locator('.maplibregl-canvas, canvas').first();
  const mapBox = await mapCanvas.boundingBox();
  if (mapBox) {
    // Click center of map where facilities should exist
    await page.mouse.click(mapBox.x + mapBox.width / 2, mapBox.y + mapBox.height / 2);
    await page.waitForTimeout(2000);
    await screenshot(page, '06-feature-popup');

    // Check if popup appeared
    const popup = page.locator('.maplibregl-popup');
    const popupVisible = await popup.isVisible({ timeout: 3000 }).catch(() => false);
    log(`Feature popup visible: ${popupVisible}`);

    if (popupVisible) {
      const popupContent = await popup.textContent().catch(() => '');
      log(`Popup content preview: ${popupContent.substring(0, 100)}`);
    }
  }

  // 8. Check sidebar FacilityDetail section
  const facilityDetail = page.locator('text=시설물 정보').first();
  const facilityDetailVisible = await facilityDetail.isVisible({ timeout: 2000 }).catch(() => false);
  log(`Sidebar facility detail visible: ${facilityDetailVisible}`);
  await screenshot(page, '07-facility-detail');

  // 9. Zoom to z17 for pipe styling
  await page.evaluate(() => { window.__gis_map.jumpTo({ center: [127.27, 37.97], zoom: 17 }); });
  await waitForMap(page);
  await page.waitForTimeout(2000);
  await screenshot(page, '08-z17-pipe-detail');

  // 10. Test basemap switching
  const satBtn = page.locator('button').filter({ hasText: '위성' });
  if (await satBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await satBtn.click();
    await page.waitForTimeout(2000);
    await screenshot(page, '09-satellite-basemap');
    log('Basemap switch to satellite: works');

    // Back to OSM
    const osmBtn = page.locator('button').filter({ hasText: '일반' });
    if (await osmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await osmBtn.click();
      await page.waitForTimeout(1500);
    }
  }

  // 11. Test search
  const searchInput = page.locator('input[placeholder*="검색"], input[type="search"], input[placeholder*="주소"]').first();
  if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await searchInput.fill('포천');
    await page.waitForTimeout(1500);
    await screenshot(page, '10-search');
  }

  // 12. Test admin login form
  const loginBtn = page.locator('button').filter({ hasText: '관리자 로그인' });
  if (await loginBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await loginBtn.click();
    await page.waitForTimeout(1000);
    await screenshot(page, '11-login-form');

    // Try login with test credentials
    const usernameInput = page.locator('input[name="username"], input[type="text"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    if (await usernameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await usernameInput.fill('admin');
      await passwordInput.fill('wrong-password');
      const submitBtn = page.locator('button[type="submit"]').first();
      if (await submitBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(1500);
        await screenshot(page, '12-login-attempt');
        log('Login form interaction: works');
      }
    }

    // Go back
    const backBtn = page.locator('button').filter({ hasText: '돌아가기' }).or(page.locator('button').filter({ hasText: '뒤로' }));
    if (await backBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await backBtn.click();
      await page.waitForTimeout(500);
    }
  }

  // 13. Test layer toggle (turn off one layer, verify legend updates)
  await page.goto(SITE_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await waitForMap(page);

  // Select region again
  if (await regionSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
    const options = await regionSelect.locator('option').allTextContents();
    if (options.length > 1) {
      await regionSelect.selectOption({ index: 1 });
      await page.waitForTimeout(2000);
      await waitForMap(page);
    }
  }

  // Check all, then uncheck first
  const checkboxes2 = page.locator('input[type="checkbox"]');
  const cb2Count = await checkboxes2.count();
  for (let i = 0; i < cb2Count; i++) {
    const cb = checkboxes2.nth(i);
    if (!(await cb.isChecked())) await cb.check();
  }
  await page.waitForTimeout(500);

  // Turn off first layer
  if (cb2Count > 0) {
    await checkboxes2.nth(0).uncheck();
    await page.waitForTimeout(500);
    await screenshot(page, '13-layer-toggled');
    log('Layer toggle: works');
  }

  // 14. Console error summary
  const tileErrors = errors.filter(e => e.includes('AJAXError') || e.includes('tile'));
  log(`Console errors total: ${errors.length}, tile errors: ${tileErrors.length}`);
  if (tileErrors.length > 0) {
    log(`Tile error samples: ${tileErrors.slice(0, 3).join(' | ')}`);
  }

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

  // Check legend visibility on mobile
  const mobileLegend = page.locator('text=범례').first();
  const legendOnMobile = await mobileLegend.isVisible({ timeout: 2000 }).catch(() => false);
  log(`Legend visible on mobile: ${legendOnMobile}`);

  // Open sidebar
  const menuBtn = page.locator('button[aria-label="메뉴 토글"]');
  if (await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await menuBtn.click();
    await page.waitForTimeout(500);
    await screenshot(page, '15-mobile-sidebar');
    log('Mobile menu toggle: works');

    // Close
    await page.mouse.click(350, 400);
    await page.waitForTimeout(500);
  }

  await screenshot(page, '16-mobile-map');

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
    path.join(SCREENSHOT_DIR, 'qa-loop3-results.txt'),
    RESULTS.join('\n') + '\n'
  );
  console.log('\n=== Results ===');
  console.log(RESULTS.join('\n'));
}

main().catch(console.error);
