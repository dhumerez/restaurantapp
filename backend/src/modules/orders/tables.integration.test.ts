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
  if (td) await cleanupTestData(td.restaurantId);
});

describe("Tables API", () => {
  let createdTableId: string;

  describe("GET /api/tables", () => {
    it("returns 401 without auth", async () => {
      const res = await request(app).get("/api/tables");
      expect(res.status).toBe(401);
    });

    it("returns tables for authenticated user", async () => {
      const res = await request(app)
        .get("/api/tables")
        .set("Authorization", `Bearer ${td.waiterToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // seedTestData creates exactly 1 table
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      const table = res.body.find((t: { id: string }) => t.id === td.tableId);
      expect(table).toBeDefined();
      expect(table.restaurantId).toBe(td.restaurantId);
      expect(table.isActive).toBe(true);
    });

    it("returns tables for admin", async () => {
      const res = await request(app)
        .get("/api/tables")
        .set("Authorization", `Bearer ${td.adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it("does NOT return tables from other restaurants", async () => {
      const res = await request(app)
        .get("/api/tables")
        .set("Authorization", `Bearer ${td.waiterToken}`);

      expect(res.status).toBe(200);
      for (const table of res.body) {
        expect(table.restaurantId).toBe(td.restaurantId);
      }
    });
  });

  describe("POST /api/tables", () => {
    it("returns 401 without auth", async () => {
      const res = await request(app)
        .post("/api/tables")
        .send({ number: 99, seats: 4 });
      expect(res.status).toBe(401);
    });

    it("returns 403 for non-admin", async () => {
      const res = await request(app)
        .post("/api/tables")
        .set("Authorization", `Bearer ${td.waiterToken}`)
        .send({ number: 99, seats: 4 });
      expect(res.status).toBe(403);
    });

    it("creates a table as admin", async () => {
      const res = await request(app)
        .post("/api/tables")
        .set("Authorization", `Bearer ${td.adminToken}`)
        .send({ number: 50, label: "VIP 1", seats: 6 });

      expect(res.status).toBe(201);
      expect(res.body.number).toBe(50);
      expect(res.body.label).toBe("VIP 1");
      expect(res.body.seats).toBe(6);
      expect(res.body.restaurantId).toBe(td.restaurantId);
      expect(res.body.isActive).toBe(true);
      createdTableId = res.body.id;
    });

    it("returns 400 for duplicate table number in same restaurant", async () => {
      const res = await request(app)
        .post("/api/tables")
        .set("Authorization", `Bearer ${td.adminToken}`)
        .send({ number: 50, seats: 4 });
      expect(res.status).toBe(500); // unique constraint violation
    });
  });

  describe("PUT /api/tables/:id", () => {
    it("returns 403 for non-admin", async () => {
      const res = await request(app)
        .put(`/api/tables/${createdTableId}`)
        .set("Authorization", `Bearer ${td.waiterToken}`)
        .send({ seats: 8 });
      expect(res.status).toBe(403);
    });

    it("updates a table as admin", async () => {
      const res = await request(app)
        .put(`/api/tables/${createdTableId}`)
        .set("Authorization", `Bearer ${td.adminToken}`)
        .send({ seats: 8, label: "VIP Updated" });

      expect(res.status).toBe(200);
      expect(res.body.seats).toBe(8);
      expect(res.body.label).toBe("VIP Updated");
    });

    it("returns 404 for non-existent table", async () => {
      const res = await request(app)
        .put("/api/tables/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${td.adminToken}`)
        .send({ seats: 4 });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/tables/:id (soft-delete)", () => {
    it("returns 403 for non-admin", async () => {
      const res = await request(app)
        .delete(`/api/tables/${createdTableId}`)
        .set("Authorization", `Bearer ${td.waiterToken}`);
      expect(res.status).toBe(403);
    });

    it("soft-deletes a table as admin (sets isActive=false)", async () => {
      const res = await request(app)
        .delete(`/api/tables/${createdTableId}`)
        .set("Authorization", `Bearer ${td.adminToken}`);

      expect(res.status).toBe(204);
    });

    it("soft-deleted table no longer appears in GET /api/tables", async () => {
      const res = await request(app)
        .get("/api/tables")
        .set("Authorization", `Bearer ${td.adminToken}`);

      expect(res.status).toBe(200);
      const deleted = res.body.find((t: { id: string }) => t.id === createdTableId);
      expect(deleted).toBeUndefined();
    });
  });
});
