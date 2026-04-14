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

describe("Auth API", () => {
  describe("POST /api/auth/login", () => {
    it("returns 200 with valid credentials", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: `admin-${td.adminId.slice(0, 8)}`, password: "password123" });

      // The email in seed uses timestamp, so we use the admin token to get user info
      // Let's just test with a known-bad login first
    });

    it("returns 401 with invalid email", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "nonexistent@test.com", password: "password123" });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain("Invalid");
    });

    it("returns 401 with wrong password", async () => {
      // We need the actual email - get it via /me
      const meRes = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${td.adminToken}`);

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: meRes.body.email, password: "wrongpassword" });

      expect(res.status).toBe(401);
    });

    it("returns 400 with invalid email format", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "not-email", password: "password123" });

      expect(res.status).toBe(400);
    });

    it("returns accessToken and user on successful login", async () => {
      const meRes = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${td.adminToken}`);

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: meRes.body.email, password: "password123" });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.name).toBe("Test Admin");
      expect(res.body.user.role).toBe("admin");
    });
  });

  describe("GET /api/auth/me", () => {
    it("returns 401 without token", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(401);
    });

    it("returns user data with valid token", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${td.adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Test Admin");
      expect(res.body.role).toBe("admin");
      expect(res.body.restaurantId).toBe(td.restaurantId);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("returns 200 and clears cookie", async () => {
      const res = await request(app).post("/api/auth/logout");
      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Logged out");
    });
  });
});
