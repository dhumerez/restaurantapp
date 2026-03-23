import { test, expect, type Page } from "@playwright/test";

async function loginAsKitchen(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill("kitchen@demo.com");
  await page.getByLabel(/password/i).fill("password123");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/kitchen/, { timeout: 10000 });
}

test.describe("Kitchen Flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsKitchen(page);
  });

  test("shows kitchen display page", async ({ page }) => {
    await expect(page.getByText(/kitchen display/i)).toBeVisible();
  });

  test("shows user name and logout button", async ({ page }) => {
    await expect(page.getByText(/chef carlos/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: /logout/i })).toBeVisible();
  });

  test("cannot access waiter pages", async ({ page }) => {
    await page.goto("/tables");
    // Should be redirected to kitchen
    await expect(page).toHaveURL(/\/kitchen/, { timeout: 5000 });
  });

  test("cannot access admin pages", async ({ page }) => {
    await page.goto("/admin");
    // Should be redirected to kitchen
    await expect(page).toHaveURL(/\/kitchen/, { timeout: 5000 });
  });

  test("shows empty state when no active orders", async ({ page }) => {
    // Page should show either order cards or the empty state message
    const orderCards = page.locator("div.bg-gray-800.rounded-xl");
    const emptyState = page.getByText("No active orders");
    const cardCount = await orderCards.count();
    if (cardCount === 0) {
      await expect(emptyState).toBeVisible({ timeout: 5000 });
    } else {
      await expect(orderCards.first()).toBeVisible();
    }
  });
});
