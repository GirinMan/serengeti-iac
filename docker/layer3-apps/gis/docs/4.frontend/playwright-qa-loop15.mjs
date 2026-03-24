import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(__dirname, "screenshots");
const SITE = process.env.GIS_URL || "https://gis.giraffe.ai.kr";
const API = process.env.GIS_API || `${SITE}/api`;

if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, `loop15-${name}.png`), fullPage: false });
  console.log(`  📸 ${name}`);
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function apiPost(url, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  return res.json();
}

async function apiGet(url, token) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  return res.json();
}

async function apiPut(url, body, token) {
  const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };
  const res = await fetch(url, { method: "PUT", headers, body: JSON.stringify(body) });
  return res.json();
}

async function apiDelete(url, token) {
  const res = await fetch(url, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
  return res.status;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const report = {};
  const consoleErrors = [];
  const tileErrors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("response", (res) => {
    if (res.url().includes("/tiles/") && res.status() >= 400) tileErrors.push(res.url());
  });

  console.log("=== Loop 15 QA Start ===");

  // 1. Initial load
  console.log("1. Initial load...");
  await page.goto(SITE, { waitUntil: "networkidle", timeout: 30000 });
  await sleep(3000);
  await shot(page, "01-initial-load");

  // 2. Enable all layers and check at z15
  console.log("2. All layers + z15...");
  const checkboxes = page.locator('input[type="checkbox"]');
  const cbCount = await checkboxes.count();
  for (let i = 0; i < cbCount; i++) {
    const cb = checkboxes.nth(i);
    if (!(await cb.isChecked())) await cb.check();
  }
  await sleep(500);

  await page.evaluate(() => {
    const map = window.__gis_map;
    if (map) map.jumpTo({ center: [127.27, 37.97], zoom: 15 });
  });
  await sleep(3000);

  const featureCounts = await page.evaluate(() => {
    const map = window.__gis_map;
    if (!map) return {};
    const counts = {};
    for (const l of map.getStyle().layers) {
      if (l.id.startsWith("lyr-")) {
        const f = map.queryRenderedFeatures(undefined, { layers: [l.id] });
        counts[l.id] = f.length;
      }
    }
    return counts;
  });
  report.feature_counts = featureCounts;
  console.log("  Features:", JSON.stringify(featureCounts));
  await shot(page, "02-all-layers-z15");

  // 3. Legend check
  console.log("3. Legend...");
  const legendItems = await page.locator('[class*="legend"] >> visible=true').count().catch(() => 0);
  report.legend_visible = legendItems > 0 || (await page.locator('text=범례').count()) > 0;
  await shot(page, "03-legend");

  // 4. Feature popup
  console.log("4. Feature popup...");
  await page.mouse.click(700, 450);
  await sleep(1500);
  await shot(page, "04-feature-popup");

  // 5. Search
  console.log("5. Search...");
  const searchInput = page.locator('input[placeholder*="검색"]').first();
  if (await searchInput.isVisible()) {
    await searchInput.fill("포천읍");
    await sleep(1500);
    await shot(page, "05-search");
    await searchInput.fill("");
  }

  // 6. Basemap satellite
  console.log("6. Satellite basemap...");
  const satBtn = page.locator('button:has-text("위성")').first();
  if (await satBtn.isVisible()) {
    await satBtn.click();
    await sleep(2000);
    await shot(page, "06-satellite");
    const osmBtn = page.locator('button:has-text("OSM")').first();
    if (await osmBtn.isVisible()) await osmBtn.click();
    await sleep(1000);
  }

  // === Admin tests ===
  console.log("7. Admin login...");
  const loginBtn = page.locator('button:has-text("로그인")').first();
  if (await loginBtn.isVisible()) await loginBtn.click();
  await sleep(500);

  const usernameInput = page.locator('#username').first();
  const passwordInput = page.locator('#password').first();
  if (await usernameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await usernameInput.fill("admin");
    await passwordInput.fill("admin1234");
    await page.locator('button[type="submit"]').first().click();
    await sleep(3000);
  }

  // Check admin badge
  const adminBadge = await page.locator('text=관리자').first().isVisible().catch(() => false);
  report.admin_badge = adminBadge;
  await shot(page, "07-admin-login");

  // 8. Open admin panel
  console.log("8. Admin panel...");
  const dataBtn = page.locator('button:has-text("데이터 관리")').first();
  if (await dataBtn.isVisible()) {
    await dataBtn.click();
    await sleep(500);
  }
  await shot(page, "08-admin-panel");

  // 9. Check custom layer section
  console.log("9. Custom layer section...");
  const customSection = await page.locator('text=커스텀 레이어').first().isVisible().catch(() => false);
  report.custom_layer_section = customSection;
  await shot(page, "09-custom-layer-section");

  // 10. Upload custom GeoJSON layer
  console.log("10. Custom layer upload...");
  const addLayerBtn = page.locator('button:has-text("+ 레이어 추가")').first();
  if (await addLayerBtn.isVisible()) {
    await addLayerBtn.click();
    await sleep(300);

    // Fill form
    const layerNameInput = page.locator('input[placeholder*="하천"]').first();
    if (await layerNameInput.isVisible()) {
      await layerNameInput.fill("QA 테스트 레이어");
    }

    // Create test GeoJSON file
    const testGeojson = JSON.stringify({
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        geometry: { type: "Point", coordinates: [127.27, 37.97] },
        properties: { name: "테스트 포인트" }
      }]
    });
    const tmpFile = path.join(__dirname, "test-custom-layer.geojson");
    fs.writeFileSync(tmpFile, testGeojson);

    const fileInput = page.locator('input[type="file"]').last();
    await fileInput.setInputFiles(tmpFile);

    // Select circle type for point data
    const typeSelect = page.locator('select').nth(0);
    // Find the select with layer types
    const selects = page.locator('form select');
    const selectCount = await selects.count();
    for (let i = 0; i < selectCount; i++) {
      const options = selects.nth(i).locator('option');
      const firstOpt = await options.first().textContent();
      if (firstOpt && firstOpt.includes("면")) {
        await selects.nth(i).selectOption("circle");
        break;
      }
    }

    await shot(page, "10-custom-layer-form");

    // Submit
    const submitBtn = page.locator('button:has-text("레이어 등록")').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await sleep(2000);
    }

    // Check success
    const successMsg = await page.locator('text=등록 완료').first().isVisible({ timeout: 3000 }).catch(() => false);
    report.custom_layer_created = successMsg;

    // Cleanup temp file
    try { fs.unlinkSync(tmpFile); } catch {}
  }
  await shot(page, "11-custom-layer-created");

  // 11. Region-based access control test via API
  console.log("11. Region access control test (API)...");
  const adminToken = await apiPost(`${API}/v1/auth/login`, { username: "admin", password: "admin1234" })
    .then(r => r.access_token);

  // Create editor user
  const editor = await apiPost(`${API}/v1/users/`, {
    username: "qa_editor_l15",
    password: "test1234",
    name: "QA Editor L15",
    role: "editor"
  }, adminToken);
  report.editor_created = !!editor.id;

  // Activate editor
  await fetch(`${API}/v1/users/${editor.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${adminToken}` },
    body: JSON.stringify({ is_active: true })
  });

  // Assign POCHEON region to editor
  await apiPut(`${API}/v1/users/${editor.id}/regions`, { region_codes: ["POCHEON"] }, adminToken);

  // Login as editor
  const editorToken = await apiPost(`${API}/v1/auth/login`, { username: "qa_editor_l15", password: "test1234" })
    .then(r => r.access_token);

  // Check editor /me has region_codes
  const editorMe = await apiGet(`${API}/v1/auth/me`, editorToken);
  report.editor_region_codes = editorMe.region_codes;

  // Check editor can see data sources (filtered)
  const editorDS = await fetch(`${API}/v1/data-sources/`, { headers: { "Authorization": `Bearer ${editorToken}` } });
  report.editor_data_sources_status = editorDS.status;

  // Check editor can see regions (filtered to assigned only)
  const editorRegions = await apiGet(`${API}/v1/regions/`, editorToken);
  report.editor_regions = editorRegions.map(r => r.code);

  // Check admin /me has all region codes
  const adminMe = await apiGet(`${API}/v1/auth/me`, adminToken);
  report.admin_region_codes = adminMe.region_codes;

  // Create viewer with NO regions
  const viewer = await apiPost(`${API}/v1/users/`, {
    username: "qa_viewer_l15",
    password: "test1234",
    name: "QA Viewer L15",
    role: "viewer"
  }, adminToken);
  await fetch(`${API}/v1/users/${viewer.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${adminToken}` },
    body: JSON.stringify({ is_active: true })
  });
  // Don't assign any regions - viewer sees all regions (public endpoint, no auth filtering for viewer)
  const viewerToken = await apiPost(`${API}/v1/auth/login`, { username: "qa_viewer_l15", password: "test1234" })
    .then(r => r.access_token);
  const viewerRegions = await apiGet(`${API}/v1/regions/`, viewerToken);
  report.viewer_regions_no_assignment = viewerRegions.map(r => r.code);

  // Cleanup test users
  await apiDelete(`${API}/v1/users/${editor.id}`, adminToken);
  await apiDelete(`${API}/v1/users/${viewer.id}`, adminToken);
  console.log("  Editor+Viewer test users cleaned up");

  // 12. Editor browser test
  console.log("12. Editor browser test...");
  // Create new editor for browser test
  const editor2 = await apiPost(`${API}/v1/users/`, {
    username: "qa_editor2_l15",
    password: "test1234",
    name: "QA Editor2 L15",
    role: "editor"
  }, adminToken);
  await fetch(`${API}/v1/users/${editor2.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${adminToken}` },
    body: JSON.stringify({ is_active: true })
  });
  await apiPut(`${API}/v1/users/${editor2.id}/regions`, { region_codes: ["POCHEON"] }, adminToken);

  // Logout admin
  const logoutBtn = page.locator('button:has-text("로그아웃")').first();
  if (await logoutBtn.isVisible()) {
    await logoutBtn.click();
    await sleep(1000);
  }

  // Login as editor
  const loginBtn2 = page.locator('button:has-text("로그인")').first();
  if (await loginBtn2.isVisible()) await loginBtn2.click();
  await sleep(500);

  const usernameInput2 = page.locator('#username').first();
  const passwordInput2 = page.locator('#password').first();
  if (await usernameInput2.isVisible({ timeout: 3000 }).catch(() => false)) {
    await usernameInput2.fill("qa_editor2_l15");
    await passwordInput2.fill("test1234");
    await page.locator('button[type="submit"]').first().click();
    await sleep(3000);
  }

  const editorBadge = await page.locator('text=편집자').first().isVisible().catch(() => false);
  report.editor_badge = editorBadge;
  await shot(page, "12-editor-login");

  // Open admin panel
  const dataBtn2 = page.locator('button:has-text("데이터 관리")').first();
  if (await dataBtn2.isVisible()) {
    await dataBtn2.click();
    await sleep(500);
  }

  // Check editor can see data sources section
  const dsSectionEditor = await page.locator('text=공공데이터 소스').first().isVisible().catch(() => false);
  report.editor_data_sources_visible = dsSectionEditor;

  // Check editor cannot see + 소스 추가 button (admin only)
  const addSourceBtn = await page.locator('button:has-text("+ 소스 추가")').first().isVisible().catch(() => false);
  report.editor_add_source_hidden = !addSourceBtn;

  // Check editor can see custom layer section
  const customSectionEditor = await page.locator('text=커스텀 레이어').first().isVisible().catch(() => false);
  report.editor_custom_layer_visible = customSectionEditor;

  // Check user management hidden for editor
  const userMgmt = await page.locator('text=사용자 관리').first().isVisible().catch(() => false);
  report.editor_user_mgmt_hidden = !userMgmt;

  await shot(page, "13-editor-admin-panel");

  // Logout editor
  const logoutBtn2 = page.locator('button:has-text("로그아웃")').first();
  if (await logoutBtn2.isVisible()) {
    await logoutBtn2.click();
    await sleep(1000);
  }

  // Cleanup editor2
  const adminToken2 = await apiPost(`${API}/v1/auth/login`, { username: "admin", password: "admin1234" })
    .then(r => r.access_token);
  await apiDelete(`${API}/v1/users/${editor2.id}`, adminToken2);
  await shot(page, "14-logout");

  // 13. Mobile test
  console.log("13. Mobile test...");
  await page.setViewportSize({ width: 375, height: 812 });
  await sleep(1500);
  await shot(page, "15-mobile-legend");

  // Summary
  report.console_errors = consoleErrors.length;
  report.tile_errors = tileErrors.length;
  report.console_error_samples = consoleErrors.slice(0, 3);

  console.log("\n=== QA Report ===");
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nScreenshots: ${SHOTS}/loop15-*.png`);
  console.log(`Console errors: ${consoleErrors.length}, Tile errors: ${tileErrors.length}`);
  console.log("=== Loop 15 QA Done ===");

  await browser.close();
})();
