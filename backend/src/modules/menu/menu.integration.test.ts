import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../test/app.js";
import { seedTestData, cleanupTestData, type TestData } from "../../test/helpers.js";

const { app } = createApp();
let td: TestData;

beforeAll(async () => {
  td = await seedTestData();
});

afterAll(async () => {
  await cleanupTestData(td.restaurantId);
});

describe("Menu API", () => {
  describe("Categories", () => {
    let newCategoryId: string;

    it("lists categories", async () => {
      const res = await request(app)
        .get("/api/categories")
        .set("Authorization", `Bearer ${td.adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("returns 401 without auth", async () => {
      const res = await request(app).get("/api/categories");
      expect(res.status).toBe(401);
    });

    it("creates category as admin", async () => {
      const res = await request(app)
        .post("/api/categories")
        .set("Authorization", `Bearer ${td.adminToken}`)
        .send({ name: "Desserts", sortOrder: 5 });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe("Desserts");
      newCategoryId = res.body.id;
    });

    it("returns 403 creating category as waiter", async () => {
      const res = await request(app)
        .post("/api/categories")
        .set("Authorization", `Bearer ${td.waiterToken}`)
        .send({ name: "Forbidden Category" });

      expect(res.status).toBe(403);
    });

    it("updates category", async () => {
      const res = await request(app)
        .put(`/api/categories/${newCategoryId}`)
        .set("Authorization", `Bearer ${td.adminToken}`)
        .send({ name: "Sweet Desserts" });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Sweet Desserts");
    });

    it("deletes category", async () => {
      const res = await request(app)
        .delete(`/api/categories/${newCategoryId}`)
        .set("Authorization", `Bearer ${td.adminToken}`);

      expect(res.status).toBe(204);
    });
  });

  describe("Menu Items", () => {
    let newItemId: string;

    it("lists menu items", async () => {
      const res = await request(app)
        .get("/api/menu-items")
        .set("Authorization", `Bearer ${td.adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2); // seeded items
    });

    it("creates menu item with stock tracking", async () => {
      const res = await request(app)
        .post("/api/menu-items")
        .set("Authorization", `Bearer ${td.adminToken}`)
        .send({
          categoryId: td.categoryId,
          name: "Test Fries",
          price: 5.50,
          stockCount: 10,
          isAvailable: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe("Test Fries");
      expect(res.body.stockCount).toBe(10);
      newItemId = res.body.id;
    });

    it("creates menu item without stock (unlimited)", async () => {
      const res = await request(app)
        .post("/api/menu-items")
        .set("Authorization", `Bearer ${td.adminToken}`)
        .send({
          categoryId: td.categoryId,
          name: "Unlimited Drink",
          price: 3.00,
        });

      expect(res.status).toBe(201);
      expect(res.body.stockCount).toBeNull();
    });

    it("updates stock via PATCH", async () => {
      const res = await request(app)
        .patch(`/api/menu-items/${newItemId}/stock`)
        .set("Authorization", `Bearer ${td.adminToken}`)
        .send({ stockCount: 20 });

      expect(res.status).toBe(200);
      expect(res.body.stockCount).toBe(20);
    });

    it("sets stock to null (unlimited)", async () => {
      const res = await request(app)
        .patch(`/api/menu-items/${newItemId}/stock`)
        .set("Authorization", `Bearer ${td.adminToken}`)
        .send({ stockCount: null });

      expect(res.status).toBe(200);
      expect(res.body.stockCount).toBeNull();
    });

    it("deletes menu item", async () => {
      const res = await request(app)
        .delete(`/api/menu-items/${newItemId}`)
        .set("Authorization", `Bearer ${td.adminToken}`);

      expect(res.status).toBe(204);
    });
  });
});
