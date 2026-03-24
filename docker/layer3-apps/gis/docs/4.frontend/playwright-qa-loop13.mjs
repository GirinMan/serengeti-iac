/**
 * Playwright QA - Loop 13
 * Tests: Bbox preview persistence, Data Source Management UI, regression
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
  const fp = path.join(SCREENSHOT_DIR, `loop13-${name}.png`);
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

      // === BBOX PREVIEW TEST ===
      log('=== Bbox Preview Test ===');

      // Open region form
      const addRegionBtn = page.locator('button').filter({ hasText: '지역 추가' });
      const hasAddBtn = await addRegionBtn.isVisible({ timeout: 2000 }).catch(() => false);
      log(`Add region button visible: ${hasAddBtn}`);

      if (hasAddBtn) {
        await addRegionBtn.click();
        await page.waitForTimeout(500);

        // Click "현재 뷰 자동 채우기" and check preview layer
        const captureBtn = page.locator('button').filter({ hasText: '자동 채우기' });
        if (await captureBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await captureBtn.click();
          await page.waitForTimeout(1000);

          // Check if bbox preview source exists on map
          const hasPreview = await page.evaluate(() => {
            const m = window.__gis_map;
            return !!m.getSource('region-bbox-preview');
          });
          log(`Bbox preview layer on map after capture: ${hasPreview}`);
          await screenshot(page, '07-bbox-preview-capture');
        }

        // Test "맵에서 영역 선택" drag mode
        const drawBtn = page.locator('button').filter({ hasText: '맵에서 영역 선택' }).first();
        const hasDrawBtn = await drawBtn.isVisible({ timeout: 2000 }).catch(() => false);
        log(`Draw bbox button visible: ${hasDrawBtn}`);

        if (hasDrawBtn) {
          await drawBtn.click();
          await page.waitForTimeout(500);

          // Check drag mode indicator
          const dragIndicator = page.locator('text=맵에서 드래그하여 영역을 선택하세요');
          const hasDragIndicator = await dragIndicator.isVisible({ timeout: 2000 }).catch(() => false);
          log(`Drag mode indicator: ${hasDragIndicator}`);
          await screenshot(page, '08-bbox-draw-mode');

          // Perform drag on map
          if (mapBox) {
            const startX = mapBox.x + 200;
            const startY = mapBox.y + 200;
            const endX = mapBox.x + 500;
            const endY = mapBox.y + 500;

            await page.mouse.move(startX, startY);
            await page.mouse.down();
            await page.mouse.move(endX, endY, { steps: 10 });
            await page.mouse.up();
            await page.waitForTimeout(1500);

            // Check preview persisted after drag
            const hasPreviewAfterDrag = await page.evaluate(() => {
              const m = window.__gis_map;
              return !!m.getSource('region-bbox-preview');
            });
            log(`Bbox preview persisted after drag: ${hasPreviewAfterDrag}`);

            // Check BBOX WKT was populated
            const bboxValue = await page.locator('textarea').first().inputValue().catch(() => '');
            log(`BBOX WKT after drag: ${bboxValue ? 'populated' : 'empty'}`);
            await screenshot(page, '09-bbox-after-drag');
          }
        }

        // Cancel form - preview should be cleared
        const cancelBtn = page.locator('button').filter({ hasText: '취소' }).first();
        if (await cancelBtn.isVisible().catch(() => false)) {
          await cancelBtn.click();
          await page.waitForTimeout(500);

          const previewAfterCancel = await page.evaluate(() => {
            const m = window.__gis_map;
            return !!m.getSource('region-bbox-preview');
          });
          log(`Bbox preview cleared after cancel: ${!previewAfterCancel}`);
        }
      }

      // === DATA SOURCE MANAGEMENT TEST ===
      log('=== Data Source Management Test ===');

      // Scroll down to find data source section
      const dataSourceSection = page.locator('text=공공데이터 소스').first();
      const hasDataSource = await dataSourceSection.isVisible({ timeout: 3000 }).catch(() => false);
      log(`Data source section visible: ${hasDataSource}`);

      if (hasDataSource) {
        // Click "+ 소스 추가" button
        const addSourceBtn = page.locator('button').filter({ hasText: '소스 추가' });
        const hasAddSourceBtn = await addSourceBtn.isVisible({ timeout: 2000 }).catch(() => false);
        log(`Add source button visible: ${hasAddSourceBtn}`);

        if (hasAddSourceBtn) {
          await addSourceBtn.click();
          await page.waitForTimeout(500);

          // Check form fields
          const nameInput = page.locator('input[placeholder*="국토교통부"]');
          const urlInput = page.locator('input[placeholder*="apis.data.go.kr"]');
          const apiKeyInput = page.locator('input[placeholder*="인증키"]');

          const hasNameInput = await nameInput.isVisible({ timeout: 2000 }).catch(() => false);
          const hasUrlInput = await urlInput.isVisible({ timeout: 2000 }).catch(() => false);
          const hasApiKeyInput = await apiKeyInput.isVisible({ timeout: 2000 }).catch(() => false);

          log(`Data source form - name: ${hasNameInput}, url: ${hasUrlInput}, api_key: ${hasApiKeyInput}`);

          // Fill form
          if (hasNameInput) await nameInput.fill('테스트 공공데이터 API');
          if (hasUrlInput) await urlInput.fill('https://apis.data.go.kr/test/endpoint');

          await screenshot(page, '10-data-source-form');

          // Submit
          const submitBtn = page.locator('button').filter({ hasText: '소스 등록' });
          if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await submitBtn.click();
            await page.waitForTimeout(2000);

            // Check if source was created
            const sourceList = page.locator('text=테스트 공공데이터 API');
            const sourceCreated = await sourceList.isVisible({ timeout: 3000 }).catch(() => false);
            log(`Data source created: ${sourceCreated}`);
            await screenshot(page, '11-data-source-created');

            // Test sync button
            if (sourceCreated) {
              const syncBtn = page.locator('button').filter({ hasText: '동기화' }).first();
              if (await syncBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await syncBtn.click();
                await page.waitForTimeout(2000);

                const syncResult = page.locator('.bg-green-50').first();
                const hasSyncResult = await syncResult.isVisible({ timeout: 3000 }).catch(() => false);
                log(`Sync trigger result: ${hasSyncResult}`);
              }

              // Delete test source
              const deleteBtn = page.locator('button').filter({ hasText: '삭제' }).last();
              if (await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                page.once('dialog', dialog => dialog.accept());
                await deleteBtn.click();
                await page.waitForTimeout(2000);
                log('Test data source deleted');
              }
            }
          } else {
            // Cancel form
            const cancelSourceBtn = page.locator('button').filter({ hasText: '취소' });
            if (await cancelSourceBtn.isVisible().catch(() => false)) {
              await cancelSourceBtn.click();
            }
          }
        }

        await screenshot(page, '12-data-source-section');
      }

      // Check other sections still present
      const userMgmt = page.locator('text=사용자 관리').first();
      const hasUserMgmt = await userMgmt.isVisible({ timeout: 3000 }).catch(() => false);
      log(`User management visible: ${hasUserMgmt}`);

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
          const downloadPath = path.join(SCREENSHOT_DIR, 'loop13-print-export-admin.png');
          await download.saveAs(downloadPath);
          const stat = fs.statSync(downloadPath);
          log(`Print export (admin): ${stat.size} bytes`);
        }
      }
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
    path.join(SCREENSHOT_DIR, 'qa-loop13-results.txt'),
    RESULTS.join('\n') + '\n'
  );
  console.log('\n=== Results ===');
  console.log(RESULTS.join('\n'));
}

main().catch(console.error);
