import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("지도 렌더링", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("MapLibre 캔버스가 렌더링된다", async ({ page }) => {
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(100);
  });

  test("지역 선택 드롭다운이 존재한다", async ({ page }) => {
    await expect(page.locator("select")).toBeVisible({ timeout: 5000 });
  });

  test("레이어 트리가 표시된다", async ({ page }) => {
    // 레이어가 로드되면 체크박스가 나타남
    const checkboxes = page.locator('input[type="checkbox"]');
    await expect(checkboxes.first()).toBeVisible({ timeout: 10000 });
  });

  test("전체 보기 버튼이 동작한다", async ({ page }) => {
    const btn = page.getByRole("button", { name: "전체 보기" });
    if (await btn.isVisible()) {
      await btn.click();
      // 지도가 이동하면서 캔버스가 계속 보임
      await expect(page.locator("canvas")).toBeVisible();
    }
  });
});
