import { test, expect, devices } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://localhost:5173";

// ─── Manifest & Service Worker ────────────────────────────────────────────────

test.describe("PWA – manifest", () => {
  test("manifest.webmanifest is served with correct headers", async ({
    request,
  }) => {
    const res = await request.get(`${BASE}/manifest.webmanifest`);
    expect(res.status()).toBe(200);

    const ct = res.headers()["content-type"] ?? "";
    expect(ct).toContain("application/manifest+json");

    const cc = res.headers()["cache-control"] ?? "";
    expect(cc).toContain("no-cache");

    const body = await res.json();
    expect(body.name).toBe("Tu Restaurante");
    expect(body.short_name).toBeTruthy();
    expect(body.start_url).toBeTruthy();
    expect(body.display).toBe("standalone");
    expect(body.icons).toBeInstanceOf(Array);
    expect(body.icons.length).toBeGreaterThanOrEqual(2);
  });

  test("icons referenced in manifest are accessible", async ({ request }) => {
    const res = await request.get(`${BASE}/manifest.webmanifest`);
    const body = await res.json();
    for (const icon of body.icons) {
      const iconRes = await request.get(`${BASE}${icon.src}`);
      expect(iconRes.status(), `icon ${icon.src} should be 200`).toBe(200);
    }
  });

  test("sw.js is served with no-cache and Service-Worker-Allowed header", async ({
    request,
  }) => {
    const res = await request.get(`${BASE}/sw.js`);
    expect(res.status()).toBe(200);
    expect(res.headers()["cache-control"]).toContain("no-cache");
    expect(res.headers()["service-worker-allowed"]).toBe("/");
  });

  test("registerSW.js is served with no-cache", async ({ request }) => {
    const res = await request.get(`${BASE}/registerSW.js`);
    expect(res.status()).toBe(200);
    expect(res.headers()["cache-control"]).toContain("no-cache");
  });

  test("apple-touch-icon is accessible", async ({ request }) => {
    const res = await request.get(`${BASE}/icons/apple-touch-icon.png`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
  });
});

// ─── index.html meta tags ─────────────────────────────────────────────────────

test.describe("PWA – HTML meta tags", () => {
  test("index.html has manifest link", async ({ page }) => {
    await page.goto(BASE);
    const manifest = await page.$('link[rel="manifest"]');
    expect(manifest).not.toBeNull();
    const href = await manifest!.getAttribute("href");
    expect(href).toContain("manifest.webmanifest");
  });

  test("index.html has theme-color meta", async ({ page }) => {
    await page.goto(BASE);
    const themeColor = await page.$('meta[name="theme-color"]');
    expect(themeColor).not.toBeNull();
  });

  test("index.html has apple-mobile-web-app-capable meta", async ({ page }) => {
    await page.goto(BASE);
    const appleMeta = await page.$('meta[name="apple-mobile-web-app-capable"]');
    expect(appleMeta).not.toBeNull();
  });

  test("index.html has apple-touch-icon link", async ({ page }) => {
    await page.goto(BASE);
    const touchIcon = await page.$('link[rel="apple-touch-icon"]');
    expect(touchIcon).not.toBeNull();
  });
});

// ─── Mobile viewport (iPhone 14 dimensions, Chrome) ──────────────────────────

test.describe("PWA – mobile layout (iPhone 14 viewport)", () => {
  // Use viewport only — avoids defaultBrowserType restriction in describe blocks
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("app loads on mobile viewport", async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveURL(/.*/, { timeout: 10000 });
    await expect(page.locator("body")).toBeVisible();
  });

  test("no horizontal scroll on mobile", async ({ page }) => {
    await page.goto(BASE);
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth
    );
    const clientWidth = await page.evaluate(
      () => document.documentElement.clientWidth
    );
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });

  test("viewport meta is set correctly", async ({ page }) => {
    await page.goto(BASE);
    const viewport = await page.$('meta[name="viewport"]');
    expect(viewport).not.toBeNull();
    const content = await viewport!.getAttribute("content");
    expect(content).toContain("width=device-width");
  });
});

// ─── Mobile viewport (Pixel 7 dimensions, Chrome) ────────────────────────────

test.describe("PWA – mobile layout (Pixel 7 viewport)", () => {
  test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });

  test("app loads on Android mobile viewport", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator("body")).toBeVisible();
  });

  test("service worker registers without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(BASE);
    await page.waitForTimeout(2000);
    const swErrors = errors.filter((e) => e.toLowerCase().includes("service worker"));
    expect(swErrors).toHaveLength(0);
    expect(await page.title()).toBeTruthy();
  });

  test("no horizontal scroll on Android viewport", async ({ page }) => {
    await page.goto(BASE);
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth
    );
    const clientWidth = await page.evaluate(
      () => document.documentElement.clientWidth
    );
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });
});
