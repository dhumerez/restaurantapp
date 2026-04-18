import { test, expect } from "@playwright/test";

// storageState is injected from playwright.config.ts (admin project)

async function ensureAdminLoggedIn(page: import("@playwright/test").Page) {
  await page.goto("admin");
  // If session expired, we land on login — re-authenticate
  const loginButton = page.getByRole("button", { name: /iniciar sesión/i });
  if (await loginButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.getByPlaceholder(/correo electrónico/i).fill("admin@demo.com");
    await page.getByPlaceholder(/contraseña/i).fill("password123");
    await loginButton.click();
  }
  await expect(page.getByRole("heading", { name: /panel de administración/i })).toBeVisible({ timeout: 15000 });
}

test.describe("Admin Flow", () => {
  test.beforeEach(async ({ page }) => {
    await ensureAdminLoggedIn(page);
  });

  test("shows admin dashboard with stats", async ({ page }) => {
    await expect(page.getByText(/productos del menú/i)).toBeVisible();
    await expect(page.getByText(/miembros del personal/i)).toBeVisible();
    await expect(page.getByText(/mesas/i).first()).toBeVisible();
  });

  test("dashboard shows ingredient low stock info", async ({ page }) => {
    await expect(page.getByText(/ingredientes con stock bajo/i)).toBeVisible();
  });

  test("sidebar shows admin navigation items", async ({ page }) => {
    await expect(page.getByRole("link", { name: /panel/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /menú/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /personal/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /mesas/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /inventario/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /reportes/i })).toBeVisible();
  });

  test("can navigate to menu management", async ({ page }) => {
    await page.getByRole("link", { name: /menú/i }).click();
    await expect(page).toHaveURL(/\/admin\/menu/);
  });

  test("can navigate to staff management", async ({ page }) => {
    await page.getByRole("link", { name: /personal/i }).click();
    await expect(page).toHaveURL(/\/admin\/staff/);
  });

  test("staff management page shows seeded staff members", async ({ page }) => {
    await page.goto("admin/staff");
    await expect(page).toHaveURL(/\/admin\/staff/);
    // Seed creates admin, waiter, kitchen, cashier — at least these emails
    await expect(page.getByText(/admin@demo\.com/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/waiter@demo\.com/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("can navigate to table management", async ({ page }) => {
    await page.getByRole("link", { name: /mesas/i }).click();
    await expect(page).toHaveURL(/\/admin\/tables/);
  });

  test("table management page shows seeded tables", async ({ page }) => {
    await page.goto("admin/tables");
    await expect(page).toHaveURL(/\/admin\/tables/);
    // Seed creates 10 tables displayed as "#1"–"#10"
    await expect(page.getByText("#1").first()).toBeVisible({ timeout: 5000 });
  });

  test("can navigate to reports", async ({ page }) => {
    await page.getByRole("link", { name: /reportes/i }).click();
    await expect(page).toHaveURL(/\/admin\/reports/);
  });

  test("can navigate to inventory", async ({ page }) => {
    await page.getByRole("link", { name: /inventario/i }).click();
    await expect(page).toHaveURL(/\/admin\/inventory/);
  });
});
