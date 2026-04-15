import { test, expect } from "@playwright/test";

test.describe("Cashier flow", () => {
  test("can view cashier tables page", async ({ page }) => {
    await page.goto("/cashier/tables");
    await expect(page.getByRole("heading", { name: "Tables" })).toBeVisible();
  });

  test("can view order detail with occupied table", async ({ page }) => {
    await page.goto("/cashier/tables");
    // Find a table with an active order (amber or green bg)
    const occupiedTable = page
      .locator("button")
      .filter({ has: page.locator(".text-accent") }) // has price
      .first();

    if (await occupiedTable.isVisible()) {
      await occupiedTable.click();
      await page.waitForURL(/\/cashier\/orders\//);
      await expect(page.getByRole("heading", { name: "Order Detail" })).toBeVisible();
      await expect(page.getByRole("button", { name: /mark served/i })).toBeVisible();
    }
  });

  test("can apply discount to order", async ({ page }) => {
    await page.goto("/cashier/tables");
    const occupiedTable = page.locator("button").filter({ has: page.locator(".text-accent") }).first();

    if (await occupiedTable.isVisible()) {
      await occupiedTable.click();
      await page.waitForURL(/\/cashier\/orders\//);

      await page.getByRole("button", { name: /discount/i }).click();
      // Modal appears
      await expect(page.getByRole("heading", { name: "Apply Discount" })).toBeVisible();
      await page.getByPlaceholder(/e.g. 10/).fill("10");
      await page.getByRole("button", { name: "Apply" }).click();
      // Modal closes
      await expect(page.getByRole("heading", { name: "Apply Discount" })).not.toBeVisible();
    }
  });
});
