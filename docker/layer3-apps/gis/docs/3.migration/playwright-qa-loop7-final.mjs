import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const ssDir = '/home/girinman/workspace/serengeti-iac/docker/layer3-apps/gis/docs/migration/screenshots';
const results = [];
function log(msg) { console.log(msg); results.push(msg); }

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const failedReqs = [];
  page.on('response', resp => {
    if (resp.status() >= 400) failedReqs.push(`${resp.status()} ${resp.url().substring(0, 150)}`);
  });

  // 1. Load page
  await page.goto('https://gis.giraffe.ai.kr', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => window.__gis_map && window.__gis_map.loaded(), { timeout: 15000 });
  log('1. Page loaded, map initialized');
  await page.screenshot({ path: `${ssDir}/loop7-final-01-initial.png` });

  // 2. Jump to Pocheon facilities area
  await page.evaluate(() => window.__gis_map.jumpTo({ center: [127.116, 37.946], zoom: 15 }));
  await page.waitForTimeout(6000);

  const feats15 = await page.evaluate(() => {
    const m = window.__gis_map;
    const all = m.queryRenderedFeatures();
    const byLayer = {};
    for (const f of all) { const lid = f.layer?.id || 'unknown'; byLayer[lid] = (byLayer[lid] || 0) + 1; }
    return { total: all.length, byLayer };
  });
  log(`2. z15 features: ${feats15.total} total`);
  for (const [k, v] of Object.entries(feats15.byLayer)) log(`   ${k}: ${v}`);
  await page.screenshot({ path: `${ssDir}/loop7-final-02-z15-facilities.png` });

  // 3. Zoom to z16 dense area
  await page.evaluate(() => window.__gis_map.jumpTo({ center: [127.2, 37.9], zoom: 16 }));
  await page.waitForTimeout(5000);
  const feats16 = await page.evaluate(() => window.__gis_map.queryRenderedFeatures().length);
  log(`3. z16 features: ${feats16}`);
  await page.screenshot({ path: `${ssDir}/loop7-final-03-z16-dense.png` });

  // 4. Layer toggle - turn off facilities
  const cbs = await page.$$('input[type="checkbox"]');
  log(`4. Checkboxes: ${cbs.length}`);
  if (cbs.length >= 4) {
    await cbs[2].click(); await cbs[3].click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${ssDir}/loop7-final-04-facilities-off.png` });
    log('   Facilities OFF');

    await cbs[2].click(); await cbs[3].click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${ssDir}/loop7-final-05-facilities-on.png` });
    log('   Facilities ON');
  }

  // 5. Turn on parcels and buildings too
  if (cbs.length >= 2) {
    await cbs[0].click(); await cbs[1].click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${ssDir}/loop7-final-06-all-layers.png` });
    log('5. All layers ON');
    await cbs[0].click(); await cbs[1].click();
    await page.waitForTimeout(1000);
  }

  // 6. Zoom out views
  for (const z of [14, 13, 12]) {
    await page.evaluate((zoom) => window.__gis_map.jumpTo({ center: [127.2, 37.9], zoom }), z);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${ssDir}/loop7-final-07-z${z}.png` });
    log(`6. Zoom ${z} screenshot`);
  }

  // 7. Sidebar details
  await page.evaluate(() => window.__gis_map.jumpTo({ center: [127.116, 37.946], zoom: 16 }));
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${ssDir}/loop7-final-08-z16-sidebar.png` });

  // 8. Search test
  const searchInput = await page.$('input[type="text"]');
  if (searchInput) {
    await searchInput.fill('포천');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${ssDir}/loop7-final-09-search.png` });
    log('8. Search test');
  }

  // 9. API checks
  const apiChecks = await page.evaluate(async () => {
    const checks = {};
    const urls = ['/api/v1/regions/', '/api/v1/layers/?region=POCHEON', '/api/v1/facilities/1'];
    for (const url of urls) {
      try {
        const r = await fetch(url);
        checks[url] = r.status;
      } catch (e) { checks[url] = 'error'; }
    }
    return checks;
  });
  log('9. API checks:');
  for (const [url, status] of Object.entries(apiChecks)) log(`   ${status} ${url}`);

  // 10. Failed requests
  log(`10. Failed requests: ${failedReqs.length}`);
  for (const r of failedReqs.slice(0, 10)) log(`   ${r}`);

  // Summary
  log('\n=== FINAL SUMMARY ===');
  log(`Page: OK`);
  log(`Map: OK (MapLibre GL)`);
  log(`Vector tiles: ${feats15.total > 0 ? 'OK' : 'FAIL'} (${feats15.total} features at z15)`);
  log(`Layer toggles: ${cbs.length}`);
  log(`APIs: ${Object.values(apiChecks).every(s => s === 200) ? 'ALL OK' : 'SOME FAILED'}`);
  log(`Failed requests: ${failedReqs.length}`);

  writeFileSync(`${ssDir}/loop7-final-results.txt`, results.join('\n'));
  await browser.close();
  log('Done');
})();
