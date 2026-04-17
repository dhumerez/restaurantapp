import { test, expect } from "@playwright/test";

test.describe("Superadmin platform", () => {
  test("sidebar shows superadmin nav items", async ({ page }) => {
    await page.goto("platform/restaurants");
    await expect(page.getByRole("link", { name: /restaurantes/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /usuarios pendientes/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /ajustes/i })).toBeVisible();
  });

  test("restaurant list shows demo restaurant", async ({ page }) => {
    await page.goto("platform/restaurants");
    await expect(page.getByRole("link", { name: /demo restaurant/i })).toBeVisible();
  });

  test("clicking a restaurant opens detail page with stats", async ({ page }) => {
    await page.goto("platform/restaurants");
    await page.getByRole("link", { name: /demo restaurant/i }).click();
    await expect(page).toHaveURL(/\/platform\/restaurants\/[0-9a-f-]+/);
    await expect(page.getByRole("heading", { name: /demo restaurant/i })).toBeVisible();
    await expect(page.getByText(/estadísticas/i)).toBeVisible();
    await expect(page.getByText(/personal/i).first()).toBeVisible();
  });

  test("settings page persists contact info", async ({ page }) => {
    await page.goto("platform/settings");
    await page.getByPlaceholder(/soporte@ejemplo\.com/i).fill("support@test.com");
    await page.getByPlaceholder(/\+1 555/i).fill("+1 555 0000");
    await page.getByRole("button", { name: /guardar/i }).click();
    await expect(page.getByText(/guardado/i)).toBeVisible();
    await page.reload();
    await expect(page.getByPlaceholder(/soporte/i)).toHaveValue("support@test.com");
  });
});
