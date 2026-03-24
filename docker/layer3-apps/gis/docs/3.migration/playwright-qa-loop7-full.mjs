import { chromium } from 'playwright';

const ssDir = '/home/girinman/workspace/serengeti-iac/docker/layer3-apps/gis/docs/migration/screenshots';

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto('https://gis.giraffe.ai.kr', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);

  // 1. Initial page
  await page.screenshot({ path: `${ssDir}/loop7-full-01-initial.png` });
  console.log('1. Initial page saved');

  // 2. Zoom to Pocheon z15
  await page.evaluate(() => window.__gis_map.flyTo({ center: [127.2, 37.9], zoom: 15, duration: 0 }));
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${ssDir}/loop7-full-02-pocheon-z15.png` });
  console.log('2. Pocheon z15 saved');

  // 3. Rendered features
  const featureInfo = await page.evaluate(() => {
    const m = window.__gis_map;
    const all = m.queryRenderedFeatures();
    const bySource = {};
    for (const f of all) bySource[f.source || 'unknown'] = (bySource[f.source] || 0) + 1;
    return { total: all.length, bySource };
  });
  console.log('3. Rendered features:', JSON.stringify(featureInfo));

  // 4. Layer toggle
  const checkboxes = await page.$$('input[type="checkbox"]');
  console.log('4. Checkboxes:', checkboxes.length);

  if (checkboxes.length >= 4) {
    await checkboxes[2].click();
    await checkboxes[3].click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${ssDir}/loop7-full-03-facilities-off.png` });
    console.log('5. Facilities off');

    await checkboxes[2].click();
    await checkboxes[3].click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${ssDir}/loop7-full-04-facilities-on.png` });
    console.log('6. Facilities on');
  }

  // 5. Click test
  await page.evaluate(() => {
    const m = window.__gis_map;
    m.fire('click', { lngLat: m.getCenter(), point: { x: 960, y: 540 }, originalEvent: new MouseEvent('click') });
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${ssDir}/loop7-full-05-click-test.png` });
  console.log('7. Click test');

  // 6. Multi-zoom
  for (const z of [14, 13, 12, 11]) {
    await page.evaluate((zoom) => window.__gis_map.setZoom(zoom), z);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${ssDir}/loop7-full-06-z${z}.png` });
    console.log(`8. Zoom ${z}`);
  }

  // 7. Dense area z16
  await page.evaluate(() => window.__gis_map.flyTo({ center: [127.116, 37.946], zoom: 16, duration: 0 }));
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${ssDir}/loop7-full-07-dense-z16.png` });

  const dense = await page.evaluate(() => {
    const m = window.__gis_map;
    const feats = m.queryRenderedFeatures();
    return {
      total: feats.length,
      sample: feats.slice(0, 3).map(f => ({ source: f.source, layer: f.layer?.id, props: f.properties }))
    };
  });
  console.log('9. Dense:', JSON.stringify(dense, null, 2));

  // 8. Errors
  console.log(errors.length > 0 ? 'ERRORS: ' + JSON.stringify(errors.slice(0, 10)) : 'No console errors');

  await browser.close();
  console.log('\nQA Complete');
})();
