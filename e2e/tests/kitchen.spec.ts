import { test, expect } from "@playwright/test";

// storageState is injected from playwright.config.ts (kitchen project)

test.describe("Kitchen Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("kitchen");
    await expect(page).toHaveURL(/\/kitchen/, { timeout: 10000 });
  });

  test("shows kitchen display page", async ({ page }) => {
    await expect(page.getByText(/pantalla de cocina/i)).toBeVisible();
  });

  test("shows user name and logout option", async ({ page }) => {
    await expect(page.getByText(/kitchen@demo\.com/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/cerrar sesión/i)).toBeVisible();
  });

  test("sidebar only shows kitchen navigation", async ({ page }) => {
    // Kitchen users should only see kitchen-related nav, not admin links
    await expect(page.getByRole("link", { name: /cocina/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /panel/i })).not.toBeVisible();
    await expect(page.getByRole("link", { name: /menú/i })).not.toBeVisible();
    await expect(page.getByRole("link", { name: /reportes/i })).not.toBeVisible();
  });

  test("shows orders or empty state", async ({ page }) => {
    const emptyState = page.getByText(/0 pedidos activos/i);
    const orderCard = page.getByText(/mesa \d/i).first();
    await expect(emptyState.or(orderCard)).toBeVisible({ timeout: 5000 });
  });
});
