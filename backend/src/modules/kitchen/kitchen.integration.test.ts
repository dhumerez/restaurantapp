import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../test/app.js";
import { seedTestData, cleanupTestData, type TestData } from "../../test/helpers.js";

const { app } = createApp();
let td: TestData;
let orderId: string;
let itemId: string;

beforeAll(async () => {
  td = await seedTestData();

  // Create, populate, and place an order for kitchen tests
  let res = await request(app)
    .post("/api/orders")
    .set("Authorization", `Bearer ${td.waiterToken}`)
    .send({ tableId: td.tableId });
  orderId = res.body.id;

  await request(app)
    .put(`/api/orders/${orderId}`)
    .set("Authorization", `Bearer ${td.waiterToken}`)
    .send({ items: [{ menuItemId: td.menuItemId, quantity: 2 }] });

  res = await request(app)
    .post(`/api/orders/${orderId}/place`)
    .set("Authorization", `Bearer ${td.waiterToken}`);

  itemId = res.body.items[0].id;
});

afterAll(async () => {
  await cleanupTestData(td.restaurantId);
});

describe("Kitchen API", () => {
  describe("GET /api/kitchen/orders", () => {
    it("returns 403 for waiter role", async () => {
      const res = await request(app)
        .get("/api/kitchen/orders")
        .set("Authorization", `Bearer ${td.waiterToken}`);

      expect(res.status).toBe(403);
    });

    it("returns active orders for kitchen role", async () => {
      const res = await request(app)
        .get("/api/kitchen/orders")
        .set("Authorization", `Bearer ${td.kitchenToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      const order = res.body.find((o: { id: string }) => o.id === orderId);
      expect(order).toBeDefined();
      expect(order.items).toBeDefined();
      expect(order.table).toBeDefined();
    });

    it("returns active orders for admin role", async () => {
      const res = await request(app)
        .get("/api/kitchen/orders")
        .set("Authorization", `Bearer ${td.adminToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe("PATCH /api/kitchen/items/:id/status", () => {
    it("updates item status to preparing", async () => {
      const res = await request(app)
        .patch(`/api/kitchen/items/${itemId}/status`)
        .set("Authorization", `Bearer ${td.kitchenToken}`)
        .send({ status: "preparing" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("preparing");
    });

    it("updates item status to ready", async () => {
      const res = await request(app)
        .patch(`/api/kitchen/items/${itemId}/status`)
        .set("Authorization", `Bearer ${td.kitchenToken}`)
        .send({ status: "ready" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ready");
    });

    it("returns 404 for non-existent item", async () => {
      const res = await request(app)
        .patch("/api/kitchen/items/00000000-0000-0000-0000-000000000000/status")
        .set("Authorization", `Bearer ${td.kitchenToken}`)
        .send({ status: "preparing" });

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/kitchen/orders/:id/status", () => {
    it("returns 400 for invalid transition", async () => {
      // Order should now be "ready" (all items ready), can't go back to preparing
      const res = await request(app)
        .patch(`/api/kitchen/orders/${orderId}/status`)
        .set("Authorization", `Bearer ${td.kitchenToken}`)
        .send({ status: "preparing" });

      expect(res.status).toBe(400);
    });

    it("transitions order from ready to served", async () => {
      const res = await request(app)
        .patch(`/api/kitchen/orders/${orderId}/status`)
        .set("Authorization", `Bearer ${td.kitchenToken}`)
        .send({ status: "served" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("served");
    });
  });
});
