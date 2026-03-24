import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const ssDir = '/home/girinman/workspace/serengeti-iac/docker/layer3-apps/gis/docs/migration/screenshots';
const results = [];
function log(msg) { console.log(msg); results.push(msg); }

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  // Track all tile requests
  const tileReqs = [];
  page.on('response', resp => {
    const url = resp.url();
    if (url.includes('.pbf') || url.includes('/tiles/')) {
      tileReqs.push({ url: url.replace('https://gis.giraffe.ai.kr', ''), status: resp.status() });
    }
  });

  const consoleMessages = [];
  page.on('console', msg => consoleMessages.push(`[${msg.type()}] ${msg.text().substring(0, 300)}`));

  await page.goto('https://gis.giraffe.ai.kr', { waitUntil: 'networkidle', timeout: 30000 });

  // Wait for map load
  await page.waitForFunction(() => window.__gis_map && window.__gis_map.loaded(), { timeout: 15000 });
  log('Map loaded');

  // Check map initial state
  const initial = await page.evaluate(() => {
    const m = window.__gis_map;
    return { center: [m.getCenter().lng.toFixed(3), m.getCenter().lat.toFixed(3)], zoom: m.getZoom().toFixed(1) };
  });
  log(`Initial: center=${initial.center}, zoom=${initial.zoom}`);

  // Jump to Pocheon with facilities
  await page.evaluate(() => window.__gis_map.jumpTo({ center: [127.116, 37.946], zoom: 15 }));
  log('Jumped to Pocheon z15');

  // Wait for tiles to load
  await page.waitForTimeout(8000);

  // Check tile requests
  log(`\nTile requests (${tileReqs.length}):`);
  for (const r of tileReqs.slice(0, 30)) {
    log(`  ${r.status} ${r.url}`);
  }

  // Check rendered features
  const feats = await page.evaluate(() => {
    const m = window.__gis_map;
    const all = m.queryRenderedFeatures();
    return {
      total: all.length,
      byLayer: Object.entries(all.reduce((acc, f) => { acc[f.layer?.id || 'unknown'] = (acc[f.layer?.id] || 0) + 1; return acc; }, {}))
    };
  });
  log(`\nRendered features: ${feats.total}`);
  for (const [k, v] of feats.byLayer) log(`  ${k}: ${v}`);

  // Check WebGL context
  const webglOk = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return 'no canvas';
    const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
    if (!gl) return 'no webgl context';
    return `WebGL OK, vendor=${gl.getParameter(gl.VENDOR)}, renderer=${gl.getParameter(gl.RENDERER)}`;
  });
  log(`\nWebGL: ${webglOk}`);

  // Check style layers with their visibility
  const layers = await page.evaluate(() => {
    const m = window.__gis_map;
    return m.getStyle().layers.map(l => ({
      id: l.id,
      type: l.type,
      source: l.source,
      sourceLayer: l['source-layer'],
      visibility: l.layout?.visibility || 'visible',
      filter: l.filter
    }));
  });
  log('\nMap layers:');
  for (const l of layers) {
    log(`  ${l.id} [${l.type}] src=${l.source}/${l.sourceLayer} vis=${l.visibility}`);
  }

  // Screenshot
  await page.screenshot({ path: `${ssDir}/loop7-v3-pocheon-z15.png` });
  log('\nScreenshot saved');

  // Console messages summary
  const errorMsgs = consoleMessages.filter(m => m.startsWith('[error]'));
  log(`\nConsole errors: ${errorMsgs.length}`);
  const unique = [...new Set(errorMsgs.map(e => e.substring(0, 100)))];
  for (const e of unique.slice(0, 10)) log(`  ${e}`);

  writeFileSync(`${ssDir}/loop7-v3-results.txt`, results.join('\n'));
  await browser.close();
  log('Done');
})();
