import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
}

test.describe("Authentication", () => {
  test("shows login page at /login", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /restaurant pos/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("redirects to /login when not authenticated", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await login(page, "wrong@test.com", "wrongpass");
    await expect(page.getByText(/invalid/i)).toBeVisible({ timeout: 5000 });
  });

  test("admin logs in and reaches dashboard", async ({ page }) => {
    await login(page, "admin@demo.com", "password123");
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
  });

  test("waiter logs in and reaches tables page", async ({ page }) => {
    await login(page, "waiter@demo.com", "password123");
    await expect(page).toHaveURL(/\/tables/, { timeout: 10000 });
  });

  test("kitchen logs in and reaches kitchen display", async ({ page }) => {
    await login(page, "kitchen@demo.com", "password123");
    await expect(page).toHaveURL(/\/kitchen/, { timeout: 10000 });
  });

  test("logout clears session and redirects to login", async ({ page }) => {
    await login(page, "admin@demo.com", "password123");
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    await page.getByRole("button", { name: /logout/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });

    // Try to navigate back - should redirect to login
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });
});
