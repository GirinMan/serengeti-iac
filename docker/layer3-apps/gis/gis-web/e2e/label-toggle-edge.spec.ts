import { test, expect, type Page } from "@playwright/test";
import { login } from "./helpers";

/** Find the parent layer checkbox by name, and its child _LABELS checkbox beneath it */
function getLayerCheckbox(page: Page, layerName: string) {
  // Parent checkbox: inside <label> containing the layer name
  const parentRow = page.locator("aside label").filter({ hasText: layerName }).first();
  const parentCheckbox = parentRow.locator('input[type="checkbox"]');
  return parentCheckbox;
}

function getLabelCheckbox(page: Page, labelName: string) {
  // Child label checkbox: inside the indented ml-5 div
  const labelRow = page.locator(".ml-5 label").filter({ hasText: labelName }).first();
  const labelCheckbox = labelRow.locator('input[type="checkbox"]');
  return labelCheckbox;
}

test.describe("라벨 토글 엣지케이스", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    // Wait for layer tree sidebar to be ready
    await expect(page.locator("aside h3:has-text('레이어')")).toBeVisible({ timeout: 10_000 });
  });

  test("부모 OFF → 라벨 ON 시 부모도 자동 ON", async ({ page }) => {
    const buildingsCheckbox = getLayerCheckbox(page, "건물");
    const buildingsLabelCheckbox = getLabelCheckbox(page, "건물명 라벨");

    await expect(buildingsCheckbox).toBeVisible();
    await expect(buildingsLabelCheckbox).toBeVisible();

    // Ensure both start checked (visible by default)
    if (await buildingsCheckbox.isChecked()) {
      // Turn off parent → child should also turn off
      await buildingsCheckbox.click();
      await expect(buildingsCheckbox).not.toBeChecked();
      await expect(buildingsLabelCheckbox).not.toBeChecked();
    }

    // Now parent is OFF, child is OFF
    // Turn ON child label → parent should auto-ON
    await buildingsLabelCheckbox.click();
    await expect(buildingsLabelCheckbox).toBeChecked();
    await expect(buildingsCheckbox).toBeChecked(); // parent auto-ON
  });

  test("부모 OFF → 라벨 ON 시 부모도 자동 ON (필지)", async ({ page }) => {
    const parcelsCheckbox = getLayerCheckbox(page, "필지");
    const parcelsLabelCheckbox = getLabelCheckbox(page, "지번 라벨");

    await expect(parcelsCheckbox).toBeVisible();
    await expect(parcelsLabelCheckbox).toBeVisible();

    // Turn off parent first
    if (await parcelsCheckbox.isChecked()) {
      await parcelsCheckbox.click();
    }
    await expect(parcelsCheckbox).not.toBeChecked();
    await expect(parcelsLabelCheckbox).not.toBeChecked();

    // Turn ON child label → parent should auto-ON
    await parcelsLabelCheckbox.click();
    await expect(parcelsLabelCheckbox).toBeChecked();
    await expect(parcelsCheckbox).toBeChecked();
  });

  test("라벨만 OFF 시 부모는 유지", async ({ page }) => {
    const buildingsCheckbox = getLayerCheckbox(page, "건물");
    const buildingsLabelCheckbox = getLabelCheckbox(page, "건물명 라벨");

    // Ensure both are ON
    if (!(await buildingsCheckbox.isChecked())) {
      await buildingsCheckbox.click();
    }
    await expect(buildingsCheckbox).toBeChecked();
    await expect(buildingsLabelCheckbox).toBeChecked();

    // Turn OFF only the label
    await buildingsLabelCheckbox.click();
    await expect(buildingsLabelCheckbox).not.toBeChecked();
    await expect(buildingsCheckbox).toBeChecked(); // parent stays ON
  });

  test("부모 ON → 자식 라벨도 함께 ON", async ({ page }) => {
    const buildingsCheckbox = getLayerCheckbox(page, "건물");
    const buildingsLabelCheckbox = getLabelCheckbox(page, "건물명 라벨");

    // Turn off parent (and child)
    if (await buildingsCheckbox.isChecked()) {
      await buildingsCheckbox.click();
    }
    await expect(buildingsCheckbox).not.toBeChecked();
    await expect(buildingsLabelCheckbox).not.toBeChecked();

    // Turn ON parent → child should also turn ON
    await buildingsCheckbox.click();
    await expect(buildingsCheckbox).toBeChecked();
    await expect(buildingsLabelCheckbox).toBeChecked();
  });
});
