import { describe, it, expect, vi } from "vitest";
import { errorHandler } from "./errorHandler.js";
import { AppError, NotFoundError, UnauthorizedError } from "../utils/errors.js";
import { ZodError, z } from "zod";
import type { Request, Response, NextFunction } from "express";

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

const mockReq = {} as Request;
const mockNext = vi.fn() as NextFunction;

describe("errorHandler", () => {
  it("handles AppError with correct status and message", () => {
    const res = mockRes();
    const err = new AppError(400, "Bad request");

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Bad request" });
  });

  it("handles NotFoundError (404)", () => {
    const res = mockRes();
    const err = new NotFoundError("Order not found");

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Order not found" });
  });

  it("handles UnauthorizedError (401)", () => {
    const res = mockRes();
    const err = new UnauthorizedError();

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
  });

  it("handles ZodError with 400 and validation details", () => {
    const res = mockRes();
    const schema = z.object({ email: z.string().email() });
    let zodErr: ZodError;
    try {
      schema.parse({ email: "not-email" });
    } catch (e) {
      zodErr = e as ZodError;
    }

    errorHandler(zodErr!, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    const call = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.error).toBe("Validation error");
    expect(call.details).toBeInstanceOf(Array);
    expect(call.details[0].path).toBe("email");
  });

  it("handles unknown errors with 500", () => {
    const res = mockRes();
    const err = new Error("Something broke");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
    consoleSpy.mockRestore();
  });
});
