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
  await page.screenshot({ path: path.join(SHOTS, `loop16-${name}.png`), fullPage: false });
  console.log(`  shot: ${name}`);
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

async function apiPatch(url, body, token) {
  const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };
  const res = await fetch(url, { method: "PATCH", headers, body: JSON.stringify(body) });
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

  console.log("=== Loop 16 QA Start ===");

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

  // 3. Check if custom GeoJSON layer is rendered on map
  console.log("3. Custom GeoJSON layer map rendering...");
  const customLayerOnMap = await page.evaluate(() => {
    const map = window.__gis_map;
    if (!map) return { found: false };
    const layers = map.getStyle().layers.filter(l => l.id.startsWith("lyr-custom_"));
    const sources = Object.keys(map.getStyle().sources).filter(s => s.startsWith("src-custom_"));
    return { layers: layers.map(l => l.id), sources, found: layers.length > 0 };
  });
  report.custom_layer_on_map = customLayerOnMap;
  console.log("  Custom layers on map:", JSON.stringify(customLayerOnMap));
  await shot(page, "03-custom-layer-on-map");

  // 4. Legend check
  console.log("4. Legend...");
  const legendVisible = await page.locator('text=범례').first().isVisible().catch(() => false);
  report.legend_visible = legendVisible;
  await shot(page, "04-legend");

  // 5. Feature popup
  console.log("5. Feature popup...");
  await page.mouse.click(700, 450);
  await sleep(1500);
  await shot(page, "05-feature-popup");

  // 6. Search
  console.log("6. Search...");
  const searchInput = page.locator('input[placeholder*="검색"]').first();
  if (await searchInput.isVisible()) {
    await searchInput.fill("포천읍");
    await sleep(1500);
    await shot(page, "06-search");
    await searchInput.fill("");
  }

  // 7. Basemap satellite
  console.log("7. Satellite basemap...");
  const satBtn = page.locator('button:has-text("위성")').first();
  if (await satBtn.isVisible()) {
    await satBtn.click();
    await sleep(2000);
    await shot(page, "07-satellite");
    const osmBtn = page.locator('button:has-text("OSM")').first();
    if (await osmBtn.isVisible()) await osmBtn.click();
    await sleep(1000);
  }

  // === Admin tests ===
  console.log("8. Admin login...");
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

  const adminBadge = await page.locator('text=관리자').first().isVisible().catch(() => false);
  report.admin_badge = adminBadge;
  await shot(page, "08-admin-login");

  // 9. Open admin panel
  console.log("9. Admin panel...");
  const dataBtn = page.locator('button:has-text("데이터 관리")').first();
  if (await dataBtn.isVisible()) {
    await dataBtn.click();
    await sleep(500);
  }
  await shot(page, "09-admin-panel");

  // 10. Custom layer style editing
  console.log("10. Custom layer style editing...");
  const styleBtn = page.locator('button:has-text("스타일")').first();
  const styleBtnVisible = await styleBtn.isVisible().catch(() => false);
  report.style_button_visible = styleBtnVisible;

  if (styleBtnVisible) {
    await styleBtn.click();
    await sleep(300);

    // Check style edit form is visible
    const colorInput = page.locator('input[type="color"]').last();
    const rangeInputs = page.locator('input[type="range"]');
    const rangeCount = await rangeInputs.count();
    report.style_edit_form = {
      color_input: await colorInput.isVisible().catch(() => false),
      range_inputs: rangeCount,
    };

    await shot(page, "10-custom-style-edit-form");

    // Change color to red
    await colorInput.evaluate((el) => {
      el.value = "#ff0000";
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await sleep(200);

    // Click save button
    const saveBtn = page.locator('button:has-text("저장")').first();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await sleep(1500);
    }

    const styleSuccess = await page.locator('text=스타일 변경 완료').first().isVisible({ timeout: 3000 }).catch(() => false);
    report.style_update_success = styleSuccess;
    await shot(page, "11-style-updated");
  }

  // 11. Test style update via API
  console.log("11. Style update API test...");
  const adminToken = await apiPost(`${API}/v1/auth/login`, { username: "admin", password: "admin1234" })
    .then(r => r.access_token);

  // Get existing custom layers
  const allLayers = await apiGet(`${API}/v1/layers/`, adminToken);
  const customLayers = allLayers.filter(l => l.category === "custom_geojson");
  if (customLayers.length > 0) {
    const cl = customLayers[0];
    const updated = await apiPatch(`${API}/v1/layers/custom/${cl.code}`, {
      color: "#00cc00",
      opacity: 0.7,
      width: 8
    }, adminToken);
    report.api_style_update = {
      code: cl.code,
      new_color: updated.style?.["circle-color"] || updated.style?.["fill-color"] || updated.style?.["line-color"],
      success: !!updated.id
    };
    console.log("  API style update:", JSON.stringify(report.api_style_update));
  }

  // 12. Non-admin region unassigned message test
  console.log("12. Region unassigned message test...");
  // Create viewer with NO regions
  const viewer = await apiPost(`${API}/v1/users/`, {
    username: "qa_viewer_l16",
    password: "test1234",
    name: "QA Viewer L16",
    role: "viewer"
  }, adminToken);
  await fetch(`${API}/v1/users/${viewer.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${adminToken}` },
    body: JSON.stringify({ is_active: true })
  });
  // Do NOT assign any regions

  // Logout admin
  const logoutBtn = page.locator('button:has-text("로그아웃")').first();
  if (await logoutBtn.isVisible()) {
    await logoutBtn.click();
    await sleep(1000);
  }

  // Login as viewer (no regions)
  const loginBtn2 = page.locator('button:has-text("로그인")').first();
  if (await loginBtn2.isVisible()) await loginBtn2.click();
  await sleep(500);

  const usernameInput2 = page.locator('#username').first();
  const passwordInput2 = page.locator('#password').first();
  if (await usernameInput2.isVisible({ timeout: 3000 }).catch(() => false)) {
    await usernameInput2.fill("qa_viewer_l16");
    await passwordInput2.fill("test1234");
    await page.locator('button[type="submit"]').first().click();
    await sleep(3000);
  }

  const viewerBadge = await page.locator('text=뷰어').first().isVisible().catch(() => false);
  report.viewer_badge = viewerBadge;

  // Check region unassigned message
  const regionMsg = await page.locator('text=지역이 할당되지 않았습니다').first().isVisible({ timeout: 3000 }).catch(() => false);
  report.region_unassigned_message = regionMsg;
  await shot(page, "12-viewer-no-region-message");

  // Check no admin panel for viewer
  const adminPanelHidden = !(await page.locator('button:has-text("데이터 관리")').first().isVisible().catch(() => false));
  report.viewer_admin_hidden = adminPanelHidden;

  // Logout viewer
  const logoutBtn2 = page.locator('button:has-text("로그아웃")').first();
  if (await logoutBtn2.isVisible()) {
    await logoutBtn2.click();
    await sleep(1000);
  }
  await shot(page, "13-viewer-logout");

  // Cleanup viewer
  const adminToken2 = await apiPost(`${API}/v1/auth/login`, { username: "admin", password: "admin1234" })
    .then(r => r.access_token);
  await apiDelete(`${API}/v1/users/${viewer.id}`, adminToken2);

  // 13. Print export
  console.log("13. Print export test...");
  // Login admin again for print test
  const loginBtn3 = page.locator('button:has-text("로그인")').first();
  if (await loginBtn3.isVisible()) await loginBtn3.click();
  await sleep(500);
  const usernameInput3 = page.locator('#username').first();
  if (await usernameInput3.isVisible({ timeout: 3000 }).catch(() => false)) {
    await usernameInput3.fill("admin");
    await page.locator('#password').first().fill("admin1234");
    await page.locator('button[type="submit"]').first().click();
    await sleep(3000);
  }

  const exportBtn = page.locator('button:has-text("내보내기")').first();
  if (await exportBtn.isVisible()) {
    await exportBtn.click();
    await sleep(500);
    const downloadPromise = page.waitForEvent("download", { timeout: 15000 }).catch(() => null);
    const printBtn = page.locator('button:has-text("인쇄 레이아웃")').first();
    if (await printBtn.isVisible()) {
      await printBtn.click();
    }
    const download = await downloadPromise;
    if (download) {
      const pngPath = path.join(SHOTS, `loop16-print-export.png`);
      await download.saveAs(pngPath);
      const stat = fs.statSync(pngPath);
      report.print_export_size = stat.size;
      console.log(`  Print export: ${stat.size} bytes`);
    }
  }

  // Logout
  const logoutBtn3 = page.locator('button:has-text("로그아웃")').first();
  if (await logoutBtn3.isVisible()) {
    await logoutBtn3.click();
    await sleep(1000);
  }
  await shot(page, "14-final-logout");

  // 14. Mobile test
  console.log("14. Mobile test...");
  await page.setViewportSize({ width: 375, height: 812 });
  await sleep(1500);
  await shot(page, "15-mobile");

  // Summary
  report.console_errors = consoleErrors.length;
  report.tile_errors = tileErrors.length;
  report.console_error_samples = consoleErrors.slice(0, 3);

  console.log("\n=== QA Report ===");
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nScreenshots: ${SHOTS}/loop16-*.png`);
  console.log(`Console errors: ${consoleErrors.length}, Tile errors: ${tileErrors.length}`);
  console.log("=== Loop 16 QA Done ===");

  await browser.close();
})();
