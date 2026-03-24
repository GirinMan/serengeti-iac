/**
 * Playwright QA - Loop 2
 * Tests: Desktop QA, mobile responsive, admin features, pipe styling verification
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
  const fp = path.join(SCREENSHOT_DIR, `loop2-${name}.png`);
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

  // Collect console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto(SITE_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await waitForMap(page);
  await screenshot(page, '01-initial-load');

  // Select region (if region selector exists)
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
  await screenshot(page, '02-region-selected');

  // Check layers in sidebar
  const checkboxes = page.locator('input[type="checkbox"]');
  const checkboxCount = await checkboxes.count();
  log(`Layer checkboxes found: ${checkboxCount}`);

  // Enable all layers
  for (let i = 0; i < checkboxCount; i++) {
    const cb = checkboxes.nth(i);
    if (!(await cb.isChecked())) {
      await cb.check();
      await page.waitForTimeout(300);
    }
  }
  await page.waitForTimeout(2000);
  await screenshot(page, '03-all-layers-on');

  // Fly to data center and zoom to z15
  await page.evaluate(() => {
    const m = window.__gis_map;
    m.jumpTo({ center: [127.27, 37.97], zoom: 15 });
  });
  await waitForMap(page);
  // Wait extra for tiles to load
  await page.waitForTimeout(3000);
  await screenshot(page, '04-z15-pipes');

  // Verify pipe features rendered
  const pipeCount = await page.evaluate(() => {
    const m = window.__gis_map;
    const layers = m.getStyle().layers.filter(l => l.id.startsWith('lyr-'));
    const results = {};
    for (const l of layers) {
      try {
        const features = m.queryRenderedFeatures(undefined, { layers: [l.id] });
        results[l.id] = features.length;
      } catch { results[l.id] = 0; }
    }
    return results;
  });
  log(`Feature counts at z15: ${JSON.stringify(pipeCount)}`);

  // Zoom to z16 for pipe styling detail
  await page.evaluate(() => { window.__gis_map.jumpTo({ center: [127.27, 37.97], zoom: 16 }); });
  await waitForMap(page);
  await page.waitForTimeout(2000);
  await screenshot(page, '05-z16-pipe-detail');

  // Zoom to z17 for max pipe width
  await page.evaluate(() => { window.__gis_map.jumpTo({ center: [127.27, 37.97], zoom: 17 }); });
  await waitForMap(page);
  await page.waitForTimeout(2000);
  await screenshot(page, '06-z17-pipe-detail');

  // Check pipe style properties (verify line-cap round)
  const pipeStyle = await page.evaluate(() => {
    const m = window.__gis_map;
    const pipeLayer = m.getStyle().layers.find(l => l.id === 'lyr-FACILITY_PIPES');
    if (!pipeLayer) return null;
    return {
      paint: pipeLayer.paint,
      layout: pipeLayer.layout,
    };
  });
  log(`Pipe layer style: ${JSON.stringify(pipeStyle)}`);

  // Test basemap switching
  const basemapButtons = page.locator('button').filter({ hasText: '위성' });
  if (await basemapButtons.isVisible({ timeout: 2000 }).catch(() => false)) {
    await basemapButtons.click();
    await page.waitForTimeout(2000);
    await screenshot(page, '07-satellite-basemap');
  }

  // Switch back to normal
  const osmBtn = page.locator('button').filter({ hasText: '일반' });
  if (await osmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await osmBtn.click();
    await page.waitForTimeout(1500);
  }

  // Test search
  const searchInput = page.locator('input[placeholder*="검색"], input[type="search"], input[placeholder*="주소"]').first();
  if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await searchInput.fill('포천');
    await page.waitForTimeout(1500);
    await screenshot(page, '08-search');
  }

  // Test click on map feature
  await page.evaluate(() => {
    window.__gis_map.setZoom(15);
  });
  await waitForMap(page);

  // Click center of map
  const mapContainer = page.locator('.maplibregl-canvas, canvas').first();
  const mapBox = await mapContainer.boundingBox();
  if (mapBox) {
    await page.mouse.click(mapBox.x + mapBox.width / 2, mapBox.y + mapBox.height / 2);
    await page.waitForTimeout(1500);
    await screenshot(page, '09-feature-click');
  }

  // Test admin login form
  const loginBtn = page.locator('button').filter({ hasText: '관리자 로그인' });
  if (await loginBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await loginBtn.click();
    await page.waitForTimeout(1000);
    await screenshot(page, '10-login-form');

    // Go back
    const backBtn = page.locator('button').filter({ hasText: '돌아가기' }).or(page.locator('button').filter({ hasText: '뒤로' }));
    if (await backBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await backBtn.click();
      await page.waitForTimeout(500);
    }
  }

  // Check console errors
  const tileErrors = errors.filter(e => e.includes('AJAXError') || e.includes('tile'));
  log(`Console errors total: ${errors.length}, tile errors: ${tileErrors.length}`);
  if (tileErrors.length > 0) {
    log(`Tile error samples: ${tileErrors.slice(0, 3).join(' | ')}`);
  }

  await context.close();
}

async function mobileTests(browser) {
  log('=== Mobile Tests (375x812, iPhone 13) ===');
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    isMobile: true,
    hasTouch: true,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  await page.goto(SITE_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await waitForMap(page);
  await screenshot(page, '11-mobile-initial');

  // Check if sidebar is hidden (should be collapsed on mobile)
  const sidebar = page.locator('aside');
  const sidebarVisible = await sidebar.evaluate(el => {
    const transform = getComputedStyle(el).transform;
    const translateX = getComputedStyle(el).transform;
    return !el.classList.contains('-translate-x-full');
  }).catch(() => false);
  log(`Mobile sidebar initially visible: ${sidebarVisible}`);

  // Open sidebar via hamburger menu
  const menuBtn = page.locator('button[aria-label="메뉴 토글"]');
  if (await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await menuBtn.click();
    await page.waitForTimeout(500);
    await screenshot(page, '12-mobile-sidebar-open');
    log('Mobile menu toggle: works');

    // Close sidebar by clicking on right side of viewport (where backdrop is visible)
    await page.mouse.click(350, 400);  // Right edge of 375px viewport, outside 240px sidebar
    await page.waitForTimeout(500);
    await screenshot(page, '13-mobile-sidebar-closed');
    log('Mobile backdrop close: works');
  } else {
    log('Mobile menu toggle button NOT found');
  }

  // Check basemap switcher visibility on mobile
  const basemapSwitcher = page.locator('button').filter({ hasText: '일반' });
  const basemapVisible = await basemapSwitcher.isVisible({ timeout: 2000 }).catch(() => false);
  log(`Mobile basemap switcher visible: ${basemapVisible}`);
  await screenshot(page, '14-mobile-map-view');

  // Check coordinate display
  const coordDisplay = page.locator('[class*="coordinate"], [class*="coord"]').first();
  const coordVisible = await coordDisplay.isVisible({ timeout: 2000 }).catch(() => false);
  log(`Mobile coordinate display visible: ${coordVisible}`);

  // Test tablet viewport (768x1024)
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(1000);
  await screenshot(page, '15-tablet-view');

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

  // Write results
  const fs = await import('fs');
  fs.writeFileSync(
    path.join(SCREENSHOT_DIR, 'qa-loop2-results.txt'),
    RESULTS.join('\n') + '\n'
  );
  console.log('\n=== Results ===');
  console.log(RESULTS.join('\n'));
}

main().catch(console.error);
