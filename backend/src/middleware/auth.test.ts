import { describe, it, expect, vi } from "vitest";
import jwt from "jsonwebtoken";
import { authenticate, authorize } from "./auth.js";
import { UnauthorizedError, ForbiddenError } from "../utils/errors.js";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET || "dev-jwt-secret-change-in-production";

function mockReq(overrides: Partial<Request> = {}): Request {
  return { headers: {}, ...overrides } as Request;
}

const mockRes = {} as Response;
const mockNext: NextFunction = vi.fn();

describe("authenticate middleware", () => {
  it("throws UnauthorizedError when no authorization header", () => {
    const req = mockReq();
    expect(() => authenticate(req, mockRes, mockNext)).toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError when header doesn't start with Bearer", () => {
    const req = mockReq({ headers: { authorization: "Basic abc" } });
    expect(() => authenticate(req, mockRes, mockNext)).toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError with invalid token", () => {
    const req = mockReq({ headers: { authorization: "Bearer invalid-token" } });
    expect(() => authenticate(req, mockRes, mockNext)).toThrow(UnauthorizedError);
  });

  it("sets req.user and calls next with valid token", () => {
    const payload = { userId: "u1", restaurantId: "r1", role: "admin" as const, scope: "restaurant" as const };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" });
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const next = vi.fn();

    authenticate(req, mockRes, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user!.userId).toBe("u1");
    expect(req.user!.restaurantId).toBe("r1");
    expect(req.user!.role).toBe("admin");
  });

  it("throws UnauthorizedError with expired token", () => {
    const payload = { userId: "u1", restaurantId: "r1", role: "admin" as const, scope: "restaurant" as const };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "-1s" });
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    expect(() => authenticate(req, mockRes, mockNext)).toThrow(UnauthorizedError);
  });
});

describe("authorize middleware", () => {
  it("throws UnauthorizedError when no user on request", () => {
    const req = mockReq();
    const middleware = authorize("admin");
    expect(() => middleware(req, mockRes, mockNext)).toThrow(UnauthorizedError);
  });

  it("throws ForbiddenError when user role is not in allowed roles", () => {
    const req = mockReq();
    req.user = { userId: "u1", restaurantId: "r1", role: "waiter", scope: "restaurant" };
    const middleware = authorize("admin");
    expect(() => middleware(req, mockRes, mockNext)).toThrow(ForbiddenError);
  });

  it("calls next when user role is in allowed roles", () => {
    const req = mockReq();
    req.user = { userId: "u1", restaurantId: "r1", role: "admin", scope: "restaurant" };
    const next = vi.fn();
    const middleware = authorize("admin", "waiter");
    middleware(req, mockRes, next);
    expect(next).toHaveBeenCalled();
  });

  it("allows multiple roles", () => {
    const req = mockReq();
    req.user = { userId: "u1", restaurantId: "r1", role: "kitchen", scope: "restaurant" };
    const next = vi.fn();
    const middleware = authorize("kitchen", "admin");
    middleware(req, mockRes, next);
    expect(next).toHaveBeenCalled();
  });
});
