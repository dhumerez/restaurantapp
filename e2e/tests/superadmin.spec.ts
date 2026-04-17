import { test, expect } from "@playwright/test";

test.describe("Superadmin platform", () => {
  test("sidebar shows superadmin nav items", async ({ page }) => {
    await page.goto("platform/restaurants");
    await expect(page.getByRole("link", { name: /restaurantes/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /usuarios pendientes/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /ajustes/i })).toBeVisible();
  });

  test("restaurant list shows demo restaurant", async ({ page }) => {
    await page.goto("platform/restaurants");
    await expect(page.getByRole("link", { name: /demo restaurant/i })).toBeVisible();
  });

  test("clicking a restaurant opens detail page with stats", async ({ page }) => {
    await page.goto("platform/restaurants");
    await page.getByRole("link", { name: /demo restaurant/i }).click();
    await expect(page).toHaveURL(/\/platform\/restaurants\/[0-9a-f-]+/);
    await expect(page.getByRole("heading", { name: /demo restaurant/i })).toBeVisible();
    await expect(page.getByText(/estadísticas/i)).toBeVisible();
    await expect(page.getByText(/personal/i).first()).toBeVisible();
  });

  test("settings page persists contact info", async ({ page }) => {
    await page.goto("platform/settings");
    await page.getByPlaceholder(/soporte@ejemplo\.com/i).fill("support@test.com");
    await page.getByPlaceholder(/\+1 555/i).fill("+1 555 0000");
    await page.getByRole("button", { name: /guardar/i }).click();
    await expect(page.getByText(/guardado/i)).toBeVisible();
    await page.reload();
    await expect(page.getByPlaceholder(/soporte/i)).toHaveValue("support@test.com");
  });

  test("assign new admin to demo restaurant shows email in admins section", async ({ page }) => {
    const email = `e2e-admin-${Date.now()}@test.com`;
    const name = `E2E Admin ${Date.now()}`;

    // Navigate to demo restaurant detail page
    await page.goto("platform/restaurants");
    await page.getByRole("link", { name: /demo restaurant/i }).click();
    await expect(page).toHaveURL(/\/platform\/restaurants\/[0-9a-f-]+/);

    // Open the assign admin modal — button label varies depending on whether admins already exist
    const assignButton = page.getByRole("button", { name: /agregar admin|asignar admin/i }).first();
    await assignButton.click();

    // Modal should be visible
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: /asignar admin/i })).toBeVisible();

    // Switch to "Nuevo" tab
    await page.getByRole("tab", { name: /nuevo/i }).click();

    // Fill in the form
    await page.getByPlaceholder(/admin@restaurante\.com/i).fill(email);
    await page.getByPlaceholder(/nombre completo/i).fill(name);
    await page.getByPlaceholder(/••••••••/i).fill("password123");

    // Submit
    await page.getByRole("button", { name: /asignar/i }).click();

    // Modal should close and the new email should appear in the admins section
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText(email)).toBeVisible({ timeout: 10000 });
  });

  test("users page: create pending user and verify it appears in filtered list", async ({ page }) => {
    const unique = Date.now();
    const email = `e2e-user-${unique}@test.com`;
    const name = `E2E User ${unique}`;

    await page.goto("platform/users");
    await expect(page.getByRole("heading", { name: /usuarios/i })).toBeVisible();

    // Open create user modal
    await page.getByRole("button", { name: /crear usuario/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Fill in name, email, password — leave Rol and Restaurante at defaults (pending / none)
    await page.getByLabel(/nombre/i).fill(name);
    await page.getByLabel(/correo/i).fill(email);
    await page.getByLabel(/contraseña/i).fill("password123");

    // Submit
    await page.getByRole("button", { name: /crear/i }).click();

    // Modal should close
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10000 });

    // Filter the table to find the new user
    await page.getByPlaceholder(/buscar por nombre o correo/i).fill(email);

    // The new user's row should be visible
    await expect(page.getByText(email)).toBeVisible({ timeout: 10000 });
  });

  test("subscription tier change on detail page persists after reload", async ({ page }) => {
    await page.goto("platform/restaurants");
    await page.getByRole("link", { name: /demo restaurant/i }).click();
    await expect(page).toHaveURL(/\/platform\/restaurants\/[0-9a-f-]+/);

    // Target the Tier select: it's the second <select> in the header (index 1)
    // 0 = status select, 1 = tier select
    const tierSelect = page.locator("select").nth(1);
    await expect(tierSelect).toBeVisible();

    // Read current tier value
    const currentTier = await tierSelect.inputValue();

    // Pick a different tier
    const allTiers = ["free", "subscribed", "allaccess"];
    const nextTier = allTiers.find((t) => t !== currentTier) ?? "free";

    await tierSelect.selectOption(nextTier);

    // Wait briefly for the mutation to settle, then reload
    await page.waitForTimeout(1000);
    await page.reload();

    // Assert the tier select now shows the new value
    const tierSelectAfterReload = page.locator("select").nth(1);
    await expect(tierSelectAfterReload).toHaveValue(nextTier);
  });
});
