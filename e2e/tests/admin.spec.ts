import { test, expect } from "@playwright/test";

// storageState is injected from playwright.config.ts (admin project)

test.describe("Admin Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("admin");
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });
  });

  test("shows admin dashboard with stats", async ({ page }) => {
    await expect(page.getByText(/pedidos de hoy/i)).toBeVisible();
    await expect(page.getByText(/pedidos activos/i)).toBeVisible();
    await expect(page.getByText(/ingresos de hoy/i)).toBeVisible();
  });

  test("dashboard has shortcut cards for Personal and Mesas", async ({ page }) => {
    await expect(page.getByRole("link", { name: /personal/i })).toBeVisible();
    await expect(page.getByText(/gestionar empleados/i)).toBeVisible();
    await expect(page.getByText(/gestionar mesas/i)).toBeVisible();
  });

  test("sidebar shows admin navigation items", async ({ page }) => {
    await expect(page.getByRole("link", { name: /panel/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /menú/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /reportes/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /pedidos/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /cocina/i })).toBeVisible();
  });

  test("can navigate to menu management", async ({ page }) => {
    await page.getByRole("link", { name: /menú/i }).click();
    await expect(page).toHaveURL(/\/admin\/menu/);
  });

  test("can navigate to staff management via dashboard card", async ({ page }) => {
    await page.getByText(/gestionar empleados/i).click();
    await expect(page).toHaveURL(/\/admin\/staff/);
    await expect(page.getByText(/gestión de personal/i)).toBeVisible({ timeout: 5000 });
  });

  test("can navigate to table management via dashboard card", async ({ page }) => {
    await page.getByText(/gestionar mesas/i).click();
    await expect(page).toHaveURL(/\/admin\/tables/);
    await expect(page.getByText(/gestión de mesas/i)).toBeVisible({ timeout: 5000 });
  });

  test("can navigate to reports", async ({ page }) => {
    await page.getByRole("link", { name: /reportes/i }).click();
    await expect(page).toHaveURL(/\/admin\/reports/);
  });

  test("can view orders page", async ({ page }) => {
    await page.getByRole("link", { name: /pedidos/i }).click();
    await expect(page).toHaveURL(/\/orders/);
  });

  test("can view kitchen display", async ({ page }) => {
    await page.getByRole("link", { name: /cocina/i }).click();
    await expect(page).toHaveURL(/\/kitchen/);
    await expect(page.getByText("Pantalla de Cocina")).toBeVisible();
  });
});
