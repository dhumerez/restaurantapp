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

    await page.goto("platform/restaurants");
    await page.getByRole("link", { name: /demo restaurant/i }).click();
    await expect(page).toHaveURL(/\/platform\/restaurants\/[0-9a-f-]+/);

    // Button label is "Asignar admin" when list is empty, "Agregar admin" otherwise
    await page.getByRole("button", { name: /^(agregar|asignar) admin$/i }).first().click();

    // Modal open — assert by modal heading (no role="dialog" on the div)
    await expect(page.getByRole("heading", { name: /^asignar admin$/i })).toBeVisible();

    // Switch to "Nuevo" tab (plain button, exact match)
    await page.getByRole("button", { name: /^nuevo$/i }).click();

    await page.getByPlaceholder(/admin@restaurante\.com/i).fill(email);
    await page.getByPlaceholder(/nombre completo/i).fill(name);
    await page.locator('input[type="password"]').fill("password123");

    // Submit button is literally "Asignar" (exact match to avoid matching "Asignar admin")
    await page.getByRole("button", { name: /^asignar$/i }).click();

    // Modal closes when heading disappears, and the new email appears in the admins section
    await expect(page.getByRole("heading", { name: /^asignar admin$/i })).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText(email)).toBeVisible({ timeout: 10000 });
  });

  test("users page: create pending user and verify it appears in filtered list", async ({ page }) => {
    const unique = Date.now();
    const email = `e2e-user-${unique}@test.com`;
    const name = `E2E User ${unique}`;

    await page.goto("platform/users");
    await expect(page.getByRole("heading", { name: /^usuarios$/i })).toBeVisible();

    // Open create user modal
    await page.getByRole("button", { name: /^crear usuario$/i }).click();
    await expect(page.getByRole("heading", { name: /^crear usuario$/i })).toBeVisible();

    // Labels aren't associated via htmlFor — select inputs by position inside the modal form.
    // Form order: Nombre (text), Correo (email), Contraseña (password), Rol (select), Restaurante (select).
    const modalForm = page.locator("form").filter({ has: page.locator('input[type="email"]') });
    await modalForm.locator('input[type="text"]').fill(name);
    await modalForm.locator('input[type="email"]').fill(email);
    await modalForm.locator('input[type="password"]').fill("password123");

    // Submit — button text is "Crear" (or "Creando…" while pending)
    await page.getByRole("button", { name: /^crear$/i }).click();

    // Modal closes when heading disappears
    await expect(page.getByRole("heading", { name: /^crear usuario$/i })).not.toBeVisible({ timeout: 10000 });

    // Filter the table to find the new user
    await page.getByPlaceholder(/buscar por nombre o correo/i).fill(email);

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
