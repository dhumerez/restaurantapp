import { test, expect } from "@playwright/test";

// Read-only smoke suite. Safe to run against production.
//   BASE_URL=https://humerez.dev/restaurant npx playwright test --project=smoke
//
// Rules for anything added here:
//   1. No writes (no create / update / delete, no login / logout).
//   2. No assumptions about data shape beyond what the seed guarantees on any
//      clean install (existence of /login, /demo, manifest, etc.).
//   3. Fail loud on 5xx or missing markers — keep assertions specific so a
//      green run means the deploy is actually serving the app.

test.describe("Prod smoke – read-only", () => {
  test("home page returns 200 and renders app shell", async ({ page }) => {
    // Empty path stays within the baseURL prefix (vs "/" which resolves to origin).
    const res = await page.goto("");
    expect(res?.status(), "home should not 5xx").toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();
    // Unauthenticated visitors bounce to /login; the sidebar brand renders on
    // the login page too.
    await expect(page.getByText(/Tu Restaurante/i)).toBeVisible();
  });

  test("login page renders the form", async ({ page }) => {
    await page.goto("login");
    await expect(page.getByPlaceholder(/correo electrónico/i)).toBeVisible();
    await expect(page.getByPlaceholder(/contraseña/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /iniciar sesión/i })).toBeVisible();
  });

  test("demo page exposes at least one role", async ({ page }) => {
    await page.goto("demo");
    await expect(page.getByRole("button", { name: /mesero/i })).toBeVisible();
  });

  test("get-session returns JSON for an anonymous visitor", async ({ request }) => {
    const res = await request.get("api/auth/get-session");
    expect(res.status()).toBe(200);
    // Unauthenticated visitors get null; we only care the endpoint is alive
    // and returns valid JSON — not what the payload looks like.
    const body = await res.text();
    expect(() => JSON.parse(body)).not.toThrow();
  });

  test("manifest.webmanifest is served in prod", async ({ request }) => {
    const res = await request.get("manifest.webmanifest");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.name).toBeTruthy();
    expect(body.start_url).toBeTruthy();
    expect(Array.isArray(body.icons)).toBe(true);
  });

  test("service worker is served in prod", async ({ request }) => {
    const res = await request.get("sw.js");
    expect(res.status()).toBe(200);
  });
});
