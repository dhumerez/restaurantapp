import { test, expect } from "@playwright/test";

// storageState is injected from playwright.config.ts (waiter project)

test.describe("Waiter Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("tables");
    await expect(page).toHaveURL(/\/tables/, { timeout: 10000 });
  });

  test("sees tables grid on tables page", async ({ page }) => {
    await expect(page.getByText(/mesas/i).first()).toBeVisible();
    // Table cards show labels like "Indoor 1", "Patio 1" and status badges
    await expect(page.getByText(/disponible/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("can navigate to orders list", async ({ page }) => {
    await page.getByRole("link", { name: /pedidos/i }).click();
    await expect(page).toHaveURL(/\/orders/);
  });

  test("cannot access admin pages", async ({ page }) => {
    await page.goto("admin");
    await expect(page).not.toHaveURL(/\/admin$/, { timeout: 5000 });
  });

  test("sidebar shows waiter navigation only", async ({ page }) => {
    await expect(page.getByRole("link", { name: /mesas/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /pedidos/i })).toBeVisible();
    // Should NOT see admin-only items
    await expect(page.getByRole("link", { name: /panel/i })).not.toBeVisible();
    await expect(page.getByRole("link", { name: /menú/i })).not.toBeVisible();
    await expect(page.getByRole("link", { name: /reportes/i })).not.toBeVisible();
  });
});
