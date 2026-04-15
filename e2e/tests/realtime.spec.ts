import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import path from "path";

const STORAGE_DIR = path.join(__dirname, "..", "test-results", "storage");
const KITCHEN_STORAGE = path.join(STORAGE_DIR, "kitchen.json");
const WAITER_STORAGE = path.join(STORAGE_DIR, "waiter.json");

const API = "http://localhost:3000/api/trpc";

// Placing an order through tRPC-over-HTTP from the waiter browser context.
// Using `page.request` inherits the session cookie stored in waiter.json.
async function placeOrderViaApi(
  request: APIRequestContext,
  menuItemName: string
): Promise<{ orderId: string; itemName: string }> {
  const tablesRes = await request.get(
    `${API}/tables.list?batch=1&input=${encodeURIComponent('{"0":{"json":null}}')}`
  );
  const tablesBody = await tablesRes.json();
  const tables = tablesBody[0].result.data;
  expect(tables.length).toBeGreaterThan(0);

  const menuRes = await request.get(
    `${API}/menu.listItems?batch=1&input=${encodeURIComponent('{"0":{"json":null}}')}`
  );
  const menuBody = await menuRes.json();
  const menu = menuBody[0].result.data;
  const item = menu.find((m: any) => m.name === menuItemName);
  expect(item, `menu item "${menuItemName}" should exist`).toBeTruthy();

  // Pick the first free table — one without a currently-placed order.
  const ordersRes = await request.get(
    `${API}/orders.list?input=${encodeURIComponent('{"status":"placed"}')}`
  );
  const ordersBody = await ordersRes.json();
  const busyTableIds = new Set(
    (ordersBody.result?.data ?? []).map((o: any) => o.tableId)
  );
  const freeTable = tables.find((t: any) => !busyTableIds.has(t.id));
  expect(freeTable, "should have at least one free table").toBeTruthy();

  const createRes = await request.post(`${API}/orders.create`, {
    data: { tableId: freeTable.id },
  });
  const createBody = await createRes.json();
  const orderId = createBody.result.data.id;

  await request.post(`${API}/orders.update`, {
    data: {
      id: orderId,
      items: [{ menuItemId: item.id, quantity: 1 }],
    },
  });

  const placeRes = await request.post(`${API}/orders.place`, {
    data: { id: orderId },
  });
  expect(placeRes.status()).toBe(200);

  return { orderId, itemName: item.name };
}

test.describe("Realtime multi-browser", () => {
  test("waiter placing an order surfaces in the kitchen browser without a refresh", async ({ browser }) => {
    const kitchenContext = await browser.newContext({ storageState: KITCHEN_STORAGE });
    const waiterContext = await browser.newContext({ storageState: WAITER_STORAGE });

    const kitchenPage: Page = await kitchenContext.newPage();
    const waiterPage: Page = await waiterContext.newPage();

    try {
      await kitchenPage.goto("kitchen");
      await expect(kitchenPage).toHaveURL(/\/kitchen/, { timeout: 10_000 });
      await expect(
        kitchenPage.getByRole("heading", { name: /pantalla de cocina/i })
      ).toBeVisible();

      // Give the WebSocket subscription time to mount before we emit an event.
      await kitchenPage.waitForTimeout(1000);

      await waiterPage.goto("tables");
      await expect(waiterPage).toHaveURL(/\/tables/, { timeout: 10_000 });

      const { itemName } = await placeOrderViaApi(waiterPage.request, "Empanadas");

      // Kitchen view must pick up the new item via the tRPC WS subscription.
      // Use a tight timeout so a broken subscription (falling back to the 30s
      // polling refetch) would fail the test.
      await expect(
        kitchenPage.getByText(new RegExp(`1×\\s*${itemName}`, "i")).first()
      ).toBeVisible({ timeout: 8_000 });
    } finally {
      await kitchenContext.close();
      await waiterContext.close();
    }
  });
});
