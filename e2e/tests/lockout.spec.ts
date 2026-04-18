import { test, expect, chromium } from "@playwright/test";
import path from "path";
import { execSync } from "child_process";

const STORAGE_DIR = path.join(__dirname, "..", "test-results", "storage");
const BASE = (process.env.BASE_URL || "http://localhost:5173").replace(/\/?$/, "");

// Direct SQL because the superadmin API enum is ["active","trial","suspended","inactive"] —
// "demo" is a seed-only status and the auth.demo.create flow specifically looks up
// a restaurant with status='demo'. If we restore to anything else, auth.spec's demo-role
// tests break on the next run.
function restoreDemoStatus() {
  execSync(
    `docker compose exec -T postgres psql -U postgres -d restaurant -c "UPDATE restaurants SET status = 'demo' WHERE name = 'Demo Restaurant';"`,
    { stdio: "ignore" }
  );
}

test.describe.serial("Restaurant inactive lockout", () => {
  test("admin is redirected to /restaurant-inactive when demo restaurant is inactive", async () => {
    const browser = await chromium.launch();

    // 1) Superadmin: set platform contact info and flip demo restaurant to inactive.
    const saCtx = await browser.newContext({ storageState: path.join(STORAGE_DIR, "superadmin.json") });
    const saPage = await saCtx.newPage();
    await saPage.goto(`${BASE}/platform/settings`);
    await saPage.getByPlaceholder(/soporte@ejemplo\.com/i).fill("lockout@test.com");
    await saPage.getByPlaceholder(/\+1 555/i).fill("+1 555 0001");
    await saPage.getByRole("button", { name: /guardar/i }).click();
    await expect(saPage.getByText(/guardado/i)).toBeVisible();

    await saPage.goto(`${BASE}/platform/restaurants`);
    const row = saPage.locator("tr", { hasText: /demo restaurant/i });
    await row.locator("select").selectOption("inactive");
    // Allow mutation to settle
    await saPage.waitForTimeout(500);

    try {
      // 2) Admin: navigate, expect redirect to /restaurant-inactive
      const adminCtx = await browser.newContext({ storageState: path.join(STORAGE_DIR, "admin.json") });
      const adminPage = await adminCtx.newPage();
      await adminPage.goto(`${BASE}/admin`);
      await expect(adminPage).toHaveURL(/\/restaurant-inactive/, { timeout: 10000 });
      await expect(adminPage.getByRole("heading", { name: /tu restaurante ha sido desactivado/i })).toBeVisible();
      await expect(adminPage.getByText(/lockout@test\.com/i)).toBeVisible();
      await expect(adminPage.getByText(/\+1 555 0001/i)).toBeVisible();
      await adminCtx.close();
    } finally {
      await saCtx.close();
      await browser.close();
      restoreDemoStatus();
    }
  });
});
