import { test, expect } from "@playwright/test";

// storageState is injected from playwright.config.ts (waiter project)

test.describe("Waiter Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/waiter/tables");
    await expect(page).toHaveURL(/\/waiter\/tables/, { timeout: 10000 });
  });

  test("sees tables grid on tables page", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /^mesas$/i })).toBeVisible();
    await expect(page.getByText(/libre/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("can navigate to orders list", async ({ page }) => {
    await page.getByRole("link", { name: /pedidos/i }).click();
    await expect(page).toHaveURL(/\/waiter\/orders/);
    await expect(page.getByRole("heading", { name: /^pedidos$/i })).toBeVisible();
  });

  test("creating order from a table shows the table header", async ({ page }) => {
    // Click the first free table in the grid.
    const firstFree = page.getByRole("button").filter({ hasText: /libre/i }).first();
    await firstFree.click();
    await expect(page).toHaveURL(/\/waiter\/orders\/(new|[0-9a-f-]+)/);
    await expect(page.getByRole("heading", { name: /^mesa\s+\d+/i })).toBeVisible({ timeout: 5000 });
  });

  test("sidebar shows waiter navigation only", async ({ page }) => {
    await expect(page.getByRole("link", { name: /mesas/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /pedidos/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /panel/i })).not.toBeVisible();
    await expect(page.getByRole("link", { name: /menú/i })).not.toBeVisible();
    await expect(page.getByRole("link", { name: /reportes/i })).not.toBeVisible();
  });
});
