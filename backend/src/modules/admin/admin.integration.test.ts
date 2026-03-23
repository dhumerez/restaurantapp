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

describe("Admin Staff API", () => {
  let staffId: string;

  it("returns 403 for non-admin", async () => {
    const res = await request(app)
      .get("/api/admin/staff")
      .set("Authorization", `Bearer ${td.waiterToken}`);

    expect(res.status).toBe(403);
  });

  it("lists staff members", async () => {
    const res = await request(app)
      .get("/api/admin/staff")
      .set("Authorization", `Bearer ${td.adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(3); // admin, waiter, kitchen
  });

  it("creates a new staff member", async () => {
    const res = await request(app)
      .post("/api/admin/staff")
      .set("Authorization", `Bearer ${td.adminToken}`)
      .send({
        name: "New Waiter",
        email: `newwaiter-${Date.now()}@test.com`,
        password: "password123",
        role: "waiter",
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("New Waiter");
    expect(res.body.role).toBe("waiter");
    expect(res.body.isActive).toBe(true);
    staffId = res.body.id;
  });

  it("updates a staff member", async () => {
    const res = await request(app)
      .put(`/api/admin/staff/${staffId}`)
      .set("Authorization", `Bearer ${td.adminToken}`)
      .send({ name: "Updated Waiter", role: "kitchen" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Updated Waiter");
    expect(res.body.role).toBe("kitchen");
  });

  it("deactivates a staff member", async () => {
    const res = await request(app)
      .delete(`/api/admin/staff/${staffId}`)
      .set("Authorization", `Bearer ${td.adminToken}`);

    expect(res.status).toBe(204);
  });

  it("deactivated staff shows isActive=false", async () => {
    const res = await request(app)
      .get("/api/admin/staff")
      .set("Authorization", `Bearer ${td.adminToken}`);

    const deactivated = res.body.find((s: { id: string }) => s.id === staffId);
    expect(deactivated.isActive).toBe(false);
  });
});
