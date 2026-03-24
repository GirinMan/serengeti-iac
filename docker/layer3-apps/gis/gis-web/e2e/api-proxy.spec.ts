import { test, expect } from "@playwright/test";

test.describe("API Proxy via nginx", () => {
  test("should proxy /api/health", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
  });

  test("should proxy /api/v1/regions/", async ({ request }) => {
    const res = await request.get("/api/v1/regions/");
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data)).toBeTruthy();
    expect(data.length).toBeGreaterThan(0);
  });

  test("should proxy /api/v1/layers/", async ({ request }) => {
    const res = await request.get("/api/v1/layers/");
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data)).toBeTruthy();
    expect(data.length).toBeGreaterThan(0);
  });

  test("should proxy /api/v1/search/address?q=포천", async ({ request }) => {
    const res = await request.get("/api/v1/search/address?q=포천");
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.total).toBeGreaterThan(0);
  });

  test("should proxy /tiles/ to pg-tileserv", async ({ request }) => {
    const res = await request.get("/tiles/");
    expect(res.ok()).toBeTruthy();
  });

  test("should proxy /features/ to pg-featureserv", async ({ request }) => {
    const res = await request.get("/features/");
    expect(res.ok()).toBeTruthy();
  });

  test("should serve SPA fallback for unknown routes", async ({ request }) => {
    const res = await request.get("/some/unknown/route");
    expect(res.ok()).toBeTruthy();
    const text = await res.text();
    expect(text.toLowerCase()).toContain("<!doctype html>");
  });
});
