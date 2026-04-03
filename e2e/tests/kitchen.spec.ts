import { test, expect } from "@playwright/test";

// storageState is injected from playwright.config.ts (kitchen project)

test.describe("Kitchen Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("kitchen");
    await expect(page).toHaveURL(/\/kitchen/, { timeout: 10000 });
  });

  test("shows kitchen display page", async ({ page }) => {
    await expect(page.getByText("Pantalla de Cocina")).toBeVisible();
  });

  test("shows user name and logout option", async ({ page }) => {
    await expect(page.getByText(/carlos/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/salir/i)).toBeVisible();
  });

  test("cannot access admin pages", async ({ page }) => {
    await page.goto("admin");
    await expect(page).toHaveURL(/\/kitchen/, { timeout: 5000 });
  });

  test("shows orders or empty state", async ({ page }) => {
    const emptyState = page.getByText(/sin pedidos activos/i);
    const orderCard = page.getByText(/mesa \d/i).first();
    await expect(emptyState.or(orderCard)).toBeVisible({ timeout: 5000 });
  });
});
