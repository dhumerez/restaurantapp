import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email: string, password: string) {
  await page.goto("login");
  await page.getByPlaceholder(/correo electrónico/i).fill(email);
  await page.getByPlaceholder(/contraseña/i).fill(password);
  await page.getByRole("button", { name: /iniciar sesión/i }).click();
}

test.describe("Authentication", () => {
  test("shows login page", async ({ page }) => {
    await page.goto("login");
    await expect(page.getByText("Tu Restaurante")).toBeVisible();
    await expect(page.getByText("Inicia sesión para continuar")).toBeVisible();
    await expect(page.getByPlaceholder(/correo electrónico/i)).toBeVisible();
    await expect(page.getByPlaceholder(/contraseña/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /iniciar sesión/i })).toBeVisible();
  });

  test("redirects to login when not authenticated", async ({ page }) => {
    await page.goto("admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await login(page, "wrong@test.com", "wrongpass");
    await expect(page.locator("text=/error|invalid|incorrect|no encontr/i")).toBeVisible({ timeout: 5000 });
  });

  test("admin logs in and reaches dashboard", async ({ page }) => {
    await login(page, "admin@demo.com", "password123");
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });
  });

  test("demo waiter role lands on waiter tables, not login", async ({ page }) => {
    await page.goto("demo");
    await page.getByRole("button", { name: /mesero/i }).click();
    await expect(page).toHaveURL(/\/waiter\/tables/, { timeout: 10000 });
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("waiter /orders index loads from sidebar (no 404)", async ({ page }) => {
    await page.goto("demo");
    await page.getByRole("button", { name: /mesero/i }).click();
    await expect(page).toHaveURL(/\/waiter\/tables/);
    await page.getByRole("link", { name: /^pedidos$/i }).click();
    await expect(page).toHaveURL(/\/waiter\/orders$/);
    await expect(page.getByRole("heading", { name: /pedidos/i })).toBeVisible();
  });

  test("logout clears session and redirects to login", async ({ page }) => {
    await login(page, "admin@demo.com", "password123");
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    await page.getByText(/cerrar sesión/i).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });

    // Try to navigate back — should redirect to login
    await page.goto("admin");
    await expect(page).toHaveURL(/\/login/);
  });
});
