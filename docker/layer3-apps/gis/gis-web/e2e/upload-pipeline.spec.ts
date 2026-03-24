import { test, expect, Page } from "@playwright/test";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { login } from "./helpers";

// Test GeoJSON: 3 point facilities in Pocheon area
const TEST_GEOJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [127.2, 37.9] },
      properties: { name: "E2E 테스트 맨홀 1", depth: 1.5, diameter: 600 },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [127.21, 37.91] },
      properties: { name: "E2E 테스트 맨홀 2", depth: 2.0, diameter: 800 },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [127.19, 37.89] },
      properties: { name: "E2E 테스트 맨홀 3", depth: 1.8, diameter: 700 },
    },
  ],
};

async function getAuthToken(page: Page): Promise<string> {
  return page.evaluate(() => localStorage.getItem("gis_token") || "");
}

async function pollImportStatus(
  page: Page,
  importId: number,
  token: string,
  maxWaitMs = 60_000,
): Promise<{ status: string; record_count: number | null }> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const result = await page.evaluate(
      async ({ id, tk }) => {
        const res = await fetch(`/api/v1/import/status/${id}`, {
          headers: { Authorization: `Bearer ${tk}` },
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json();
      },
      { id: importId, tk: token },
    );
    if (result.status === "completed" || result.status === "failed") {
      return {
        status: result.status,
        record_count: result.record_count,
      };
    }
    await page.waitForTimeout(2000);
  }
  throw new Error(`Import ${importId} did not complete within ${maxWaitMs}ms`);
}

test.describe("Upload Pipeline (Full Cycle) @full-stack", () => {
  let testGeoJsonPath: string;
  let createdImportId: number | null = null;
  let adminToken: string | null = null;

  test.beforeAll(() => {
    // Write test GeoJSON to a temp file
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    testGeoJsonPath = path.join(currentDir, "test-upload.geojson");
    fs.writeFileSync(testGeoJsonPath, JSON.stringify(TEST_GEOJSON));
  });

  test.afterAll(async ({ browser }) => {
    // Cleanup temp file
    if (fs.existsSync(testGeoJsonPath)) {
      fs.unlinkSync(testGeoJsonPath);
    }

    // Rollback import data via API
    if (createdImportId && adminToken) {
      const page = await browser.newPage();
      try {
        await page.goto("/");
        await page.evaluate(
          async ({ id, tk }) => {
            await fetch(`/api/v1/import/rollback/${id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${tk}` },
            });
          },
          { id: createdImportId, tk: adminToken },
        );
      } finally {
        await page.close();
      }
    }
  });

  test("should upload GeoJSON and process through full pipeline", async ({
    page,
  }) => {
    // Increase timeout for this test (Worker processing can take time)
    test.setTimeout(90_000);

    // Step 1: Login as admin
    await login(page);
    const token = await getAuthToken(page);
    expect(token).toBeTruthy();

    // Step 3: Open admin panel
    const adminToggle = page.getByText("데이터 관리");
    await expect(adminToggle).toBeVisible({ timeout: 5_000 });
    await adminToggle.click();
    await expect(page.getByText("파일 업로드")).toBeVisible();

    // Step 4: Select target table = facilities
    const uploadForm = page.locator("form");
    const tableSelect = uploadForm.locator("select").first();
    await tableSelect.selectOption("facilities");

    // Step 5: Select facility type = MANHOLE_SEW
    await expect(page.getByText("시설물 유형")).toBeVisible();
    const typeSelect = uploadForm.locator("select").nth(1);
    await typeSelect.selectOption("MANHOLE_SEW");

    // Step 6: Upload GeoJSON file
    const fileInput = uploadForm.locator('input[type="file"]');
    await fileInput.setInputFiles(testGeoJsonPath);

    // Step 7: Click upload button
    const uploadButton = uploadForm.locator('button[type="submit"]');
    await expect(uploadButton).toBeEnabled();
    await uploadButton.click();

    // Step 8: Wait for success message in UI
    const successMsg = page.locator(".bg-green-50");
    await expect(successMsg).toBeVisible({ timeout: 30_000 });
    const msgText = await successMsg.textContent();
    expect(msgText).toContain("ID:");

    // Extract import ID from success message
    const idMatch = msgText?.match(/ID:\s*(\d+)/);
    expect(idMatch).toBeTruthy();
    const importId = parseInt(idMatch![1], 10);

    // Store for afterAll cleanup
    createdImportId = importId;
    adminToken = token;

    // Step 9: Poll import status until completed
    const result = await pollImportStatus(page, importId, token, 60_000);
    expect(result.status).toBe("completed");
    expect(result.record_count).toBe(3);
  });

  test("should show import in history after upload", async ({ page }) => {
    test.setTimeout(30_000);

    await login(page);
    const token = await getAuthToken(page);

    // Check import history via API
    const history = await page.evaluate(async (tk) => {
      const res = await fetch("/api/v1/import/history?limit=5", {
        headers: { Authorization: `Bearer ${tk}` },
      });
      if (!res.ok) return [];
      return res.json();
    }, token);

    expect(history.length).toBeGreaterThan(0);
    // Most recent import should be our test upload
    const latest = history[0];
    expect(latest.file_type).toBe("geojson");
    expect(latest.target_table).toBe("gis.facilities");
  });
});
