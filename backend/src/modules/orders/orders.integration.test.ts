import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { createApp } from "../../test/app.js";
import { seedTestData, cleanupTestData, type TestData } from "../../test/helpers.js";
import { db } from "../../config/db.js";
import { menuItems } from "../../db/schema.js";

const { app } = createApp();
let td: TestData;

beforeAll(async () => {
  td = await seedTestData();
});

afterAll(async () => {
  if (td) await cleanupTestData(td.restaurantId);
});

describe("Orders API", () => {
  let orderId: string;

  describe("POST /api/orders", () => {
    it("returns 401 without auth", async () => {
      const res = await request(app)
        .post("/api/orders")
        .send({ tableId: td.tableId });
      expect(res.status).toBe(401);
    });

    it("returns 403 for kitchen role", async () => {
      const res = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${td.kitchenToken}`)
        .send({ tableId: td.tableId });
      expect(res.status).toBe(403);
    });

    it("creates a draft order as waiter", async () => {
      const res = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${td.waiterToken}`)
        .send({ tableId: td.tableId, notes: "Test order" });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe("draft");
      expect(res.body.tableId).toBe(td.tableId);
      expect(res.body.waiterId).toBe(td.waiterId);
      orderId = res.body.id;
    });

    it("returns 404 for non-existent table", async () => {
      const res = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${td.waiterToken}`)
        .send({ tableId: "00000000-0000-0000-0000-000000000000" });
      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/orders/:id (add items)", () => {
    it("adds items to draft order", async () => {
      const res = await request(app)
        .put(`/api/orders/${orderId}`)
        .set("Authorization", `Bearer ${td.waiterToken}`)
        .send({
          items: [
            { menuItemId: td.menuItemId, quantity: 2 },
            { menuItemId: td.menuItemWithStockId, quantity: 1, notes: "Medium rare" },
          ],
          notes: "Updated notes",
        });

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
      expect(parseFloat(res.body.subtotal)).toBeGreaterThan(0);
      expect(parseFloat(res.body.tax)).toBeGreaterThan(0);
      expect(parseFloat(res.body.total)).toBeGreaterThan(0);
    });
  });

  describe("POST /api/orders/:id/place", () => {
    it("places the order and decrements stock", async () => {
      // Check stock before
      const [before] = await db
        .select({ stockCount: menuItems.stockCount })
        .from(menuItems)
        .where(eq(menuItems.id, td.menuItemWithStockId));

      const res = await request(app)
        .post(`/api/orders/${orderId}/place`)
        .set("Authorization", `Bearer ${td.waiterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("placed");

      // Check stock after
      const [after] = await db
        .select({ stockCount: menuItems.stockCount })
        .from(menuItems)
        .where(eq(menuItems.id, td.menuItemWithStockId));

      expect(after.stockCount).toBe(before.stockCount! - 1);
    });

    it("returns 400 trying to place already-placed order", async () => {
      const res = await request(app)
        .post(`/api/orders/${orderId}/place`)
        .set("Authorization", `Bearer ${td.waiterToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/orders", () => {
    it("returns orders for waiter (filtered to own orders)", async () => {
      const res = await request(app)
        .get("/api/orders")
        .set("Authorization", `Bearer ${td.waiterToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // All orders should belong to this waiter
      for (const order of res.body) {
        expect(order.waiterId).toBe(td.waiterId);
      }
    });

    it("returns all orders for admin", async () => {
      const res = await request(app)
        .get("/api/orders")
        .set("Authorization", `Bearer ${td.adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("filters by status", async () => {
      const res = await request(app)
        .get("/api/orders?status=placed")
        .set("Authorization", `Bearer ${td.waiterToken}`);

      expect(res.status).toBe(200);
      for (const order of res.body) {
        expect(order.status).toBe("placed");
      }
    });
  });

  describe("GET /api/orders/:id", () => {
    it("returns order detail with items", async () => {
      const res = await request(app)
        .get(`/api/orders/${orderId}`)
        .set("Authorization", `Bearer ${td.waiterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(orderId);
      expect(res.body.items).toBeDefined();
      expect(res.body.table).toBeDefined();
      expect(res.body.waiter).toBeDefined();
    });

    it("returns 404 for non-existent order", async () => {
      const res = await request(app)
        .get("/api/orders/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${td.waiterToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/orders/:id/cancel", () => {
    let cancelOrderId: string;

    it("creates and places an order to cancel", async () => {
      // Create
      let res = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${td.waiterToken}`)
        .send({ tableId: td.tableId });
      cancelOrderId = res.body.id;

      // Add items
      await request(app)
        .put(`/api/orders/${cancelOrderId}`)
        .set("Authorization", `Bearer ${td.waiterToken}`)
        .send({ items: [{ menuItemId: td.menuItemId, quantity: 1 }] });

      // Place
      res = await request(app)
        .post(`/api/orders/${cancelOrderId}/place`)
        .set("Authorization", `Bearer ${td.waiterToken}`);
      expect(res.status).toBe(200);
    });

    it("cancels the order and restores stock", async () => {
      const res = await request(app)
        .patch(`/api/orders/${cancelOrderId}/cancel`)
        .set("Authorization", `Bearer ${td.waiterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("cancelled");
    });
  });
});
