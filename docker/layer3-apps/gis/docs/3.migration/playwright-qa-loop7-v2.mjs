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

  const consoleErrs = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrs.push(msg.text().substring(0, 200)); });

  // Load page
  await page.goto('https://gis.giraffe.ai.kr', { waitUntil: 'networkidle', timeout: 30000 });

  // Wait for map to fully initialize
  await page.waitForFunction(() => window.__gis_map && window.__gis_map.loaded(), { timeout: 15000 }).catch(() => {
    log('WARN: Map not loaded after 15s, waiting more...');
  });
  await page.waitForTimeout(3000);

  // 1. Initial
  await page.screenshot({ path: `${ssDir}/loop7-v2-01-initial.png` });
  log('1. Initial page OK');

  // Check map
  const hasMap = await page.evaluate(() => !!window.__gis_map);
  log(`Map instance: ${hasMap}`);

  if (!hasMap) {
    log('ERROR: No map instance. Aborting.');
    await browser.close();
    writeFileSync(`${ssDir}/loop7-v2-results.txt`, results.join('\n'));
    return;
  }

  // 2. Get tile source URLs
  const sources = await page.evaluate(() => {
    const m = window.__gis_map;
    const s = m.getStyle();
    const info = {};
    for (const [k, v] of Object.entries(s.sources)) {
      info[k] = { type: v.type, tiles: v.tiles };
    }
    return info;
  });
  log('2. Tile sources:');
  for (const [k, v] of Object.entries(sources)) {
    log(`   ${k}: ${JSON.stringify(v.tiles || [])}`);
  }

  // 3. Fly to Pocheon z15
  await page.evaluate(() => {
    window.__gis_map.jumpTo({ center: [127.2, 37.9], zoom: 15 });
  });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${ssDir}/loop7-v2-02-pocheon-z15.png` });
  log('3. Pocheon z15 screenshot');

  // 4. Query rendered features
  const features = await page.evaluate(() => {
    const m = window.__gis_map;
    const all = m.queryRenderedFeatures();
    const byLayer = {};
    for (const f of all) {
      const lid = f.layer?.id || 'unknown';
      byLayer[lid] = (byLayer[lid] || 0) + 1;
    }
    return { total: all.length, byLayer };
  });
  log(`4. Rendered features: total=${features.total}`);
  for (const [k, v] of Object.entries(features.byLayer)) {
    log(`   ${k}: ${v}`);
  }

  // 5. Dense area z16
  await page.evaluate(() => window.__gis_map.jumpTo({ center: [127.116, 37.946], zoom: 16 }));
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${ssDir}/loop7-v2-03-dense-z16.png` });

  const dense = await page.evaluate(() => {
    const m = window.__gis_map;
    const feats = m.queryRenderedFeatures();
    const sample = feats.slice(0, 5).map(f => ({
      layer: f.layer?.id,
      source: f.source,
      sourceLayer: f.sourceLayer,
      props: Object.keys(f.properties || {}).join(',')
    }));
    return { total: feats.length, sample };
  });
  log(`5. Dense features: total=${dense.total}`);
  for (const s of dense.sample) log(`   ${s.layer} (${s.source}/${s.sourceLayer}): ${s.props}`);

  // 6. Layer toggle
  const cbs = await page.$$('input[type="checkbox"]');
  log(`6. Checkboxes: ${cbs.length}`);
  if (cbs.length >= 4) {
    // Turn off facilities
    await cbs[2].click();
    await cbs[3].click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${ssDir}/loop7-v2-04-fac-off.png` });
    log('   Facilities OFF');

    // Turn on
    await cbs[2].click();
    await cbs[3].click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${ssDir}/loop7-v2-05-fac-on.png` });
    log('   Facilities ON');
  }

  // 7. Multi-zoom
  for (const z of [14, 13, 12]) {
    await page.evaluate((zoom) => window.__gis_map.jumpTo({ center: [127.2, 37.9], zoom }), z);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${ssDir}/loop7-v2-06-z${z}.png` });
    log(`7. Zoom ${z} saved`);
  }

  // 8. Network errors
  log(`8. Failed requests: ${failedReqs.length}`);
  for (const r of failedReqs.slice(0, 15)) log(`   ${r}`);

  log(`9. Console errors: ${consoleErrs.length}`);
  for (const e of consoleErrs.slice(0, 10)) log(`   ${e}`);

  // Summary
  log('=== SUMMARY ===');
  log(`Page: OK`);
  log(`Map: ${hasMap ? 'OK' : 'FAIL'}`);
  log(`Features rendered: ${features.total} (z15), ${dense.total} (z16 dense)`);
  log(`Layer toggles: ${cbs.length}`);
  log(`Failed requests: ${failedReqs.length}`);
  log(`Console errors: ${consoleErrs.length}`);

  writeFileSync(`${ssDir}/loop7-v2-results.txt`, results.join('\n'));
  await browser.close();
  log('Done');
})();
