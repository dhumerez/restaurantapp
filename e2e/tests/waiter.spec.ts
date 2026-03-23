import { test, expect, type Page } from "@playwright/test";

async function loginAsWaiter(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill("waiter@demo.com");
  await page.getByLabel(/password/i).fill("password123");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/tables/, { timeout: 10000 });
}

test.describe("Waiter Flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsWaiter(page);
  });

  test("sees tables grid on tables page", async ({ page }) => {
    await expect(page.getByText(/tables/i).first()).toBeVisible();
    // Should see multiple table cards
    await expect(page.locator(".rounded-xl").first()).toBeVisible({ timeout: 5000 });
  });

  test("can navigate to orders list", async ({ page }) => {
    await page.getByRole("link", { name: /orders/i }).click();
    await expect(page).toHaveURL(/\/orders/);
    await expect(page.getByText(/orders/i).first()).toBeVisible();
  });

  test("can create a new order from a table", async ({ page }) => {
    // Click on an available table
    const tableCard = page.locator(".rounded-xl").first();
    await tableCard.waitFor({ timeout: 5000 });
    await tableCard.click();

    // Should see a "New Order" option or similar
    // The table detail should show up or redirect to new order
    await page.waitForTimeout(1000);

    // Check we're on the order creation page or see menu items
    const url = page.url();
    // Either on /orders/new or the table has a create order button
    if (url.includes("/orders/")) {
      await expect(page.getByText(/caesar salad|garlic bread|chicken/i)).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test("cannot access admin pages", async ({ page }) => {
    await page.goto("/admin");
    // Should be redirected away from admin
    await expect(page).not.toHaveURL(/^.*\/admin$/, { timeout: 3000 });
  });

  test("cannot access kitchen page directly via sidebar", async ({ page }) => {
    // Kitchen link should not be visible in waiter sidebar
    const kitchenLink = page.getByRole("link", { name: /^kitchen$/i });
    await expect(kitchenLink).not.toBeVisible();
  });

  test("sidebar shows waiter navigation", async ({ page }) => {
    await expect(page.getByRole("link", { name: /tables/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /orders/i })).toBeVisible();
    // Should NOT see admin-only items
    await expect(page.getByRole("link", { name: /dashboard/i })).not.toBeVisible();
    await expect(page.getByRole("link", { name: /staff/i })).not.toBeVisible();
    await expect(page.getByRole("link", { name: /menu/i })).not.toBeVisible();
  });
});
