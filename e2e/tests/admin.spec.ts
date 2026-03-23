import { test, expect, type Page } from "@playwright/test";

async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill("admin@demo.com");
  await page.getByLabel(/password/i).fill("password123");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });
}

test.describe("Admin Flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("shows admin dashboard", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
  });

  test("sidebar shows all admin navigation items", async ({ page }) => {
    await expect(page.getByRole("link", { name: /dashboard/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /menu/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /staff/i })).toBeVisible();
    await expect(page.getByRole("link").filter({ hasText: "Tables Config" })).toBeVisible();
    await expect(page.getByRole("link").filter({ hasText: "Tables" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /orders/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /kitchen/i })).toBeVisible();
  });

  test("can view menu management", async ({ page }) => {
    await page.getByRole("link", { name: /menu/i }).click();
    await expect(page).toHaveURL(/\/admin\/menu/);
    await expect(page.getByText(/menu/i).first()).toBeVisible();
    // Should see categories and items from seed
    await expect(page.getByText(/starters|main course|desserts/i).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("can view staff management", async ({ page }) => {
    await page.getByRole("link", { name: /staff/i }).click();
    await expect(page).toHaveURL(/\/admin\/staff/);
    // Should see seeded staff
    await expect(page.getByText(/admin user|maria|chef carlos/i)).toBeVisible({ timeout: 5000 });
  });

  test("can view table configuration", async ({ page }) => {
    await page.getByRole("link").filter({ hasText: "Tables Config" }).click();
    await expect(page).toHaveURL(/\/admin\/tables/);
    await expect(page.getByText(/table/i).first()).toBeVisible();
  });

  test("can view orders page", async ({ page }) => {
    await page.getByRole("link", { name: /orders/i }).click();
    await expect(page).toHaveURL(/\/orders/);
    await expect(page.getByText(/orders/i).first()).toBeVisible();
  });

  test("can view kitchen display", async ({ page }) => {
    await page.getByRole("link", { name: /kitchen/i }).click();
    await expect(page).toHaveURL(/\/kitchen/);
    await expect(page.getByText(/kitchen display/i)).toBeVisible();
  });
});
