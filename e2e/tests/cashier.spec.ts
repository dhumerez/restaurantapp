import { test, expect } from "@playwright/test";

test.describe("Cashier flow", () => {
  test("can view cashier tables page", async ({ page }) => {
    await page.goto("cashier/tables");
    await expect(page.getByRole("heading", { name: /mesas/i })).toBeVisible();
  });

  test("can view order detail with occupied table", async ({ page }) => {
    await page.goto("cashier/tables");
    // Find a table with an active order (has a price displayed)
    const occupiedTable = page
      .locator("button")
      .filter({ has: page.locator(".text-accent") }) // has price
      .first();

    if (await occupiedTable.isVisible()) {
      await occupiedTable.click();
      await page.waitForURL(/\/cashier\/orders\//);
      await expect(page.getByRole("heading", { name: /detalle del pedido/i })).toBeVisible();
      await expect(page.getByText(/marcar como servido/i)).toBeVisible();
    }
  });

  test("can apply discount to order", async ({ page }) => {
    await page.goto("cashier/tables");
    const occupiedTable = page.locator("button").filter({ has: page.locator(".text-accent") }).first();

    if (await occupiedTable.isVisible()) {
      await occupiedTable.click();
      await page.waitForURL(/\/cashier\/orders\//);

      await page.getByText(/descuento/i).first().click();
      // Modal appears
      await expect(page.getByRole("heading", { name: /aplicar descuento/i })).toBeVisible();
      await page.getByPlaceholder(/ej\. 10/).fill("10");
      await page.getByRole("button", { name: /aplicar/i }).click();
      // Modal closes
      await expect(page.getByRole("heading", { name: /aplicar descuento/i })).not.toBeVisible();
    }
  });
});
