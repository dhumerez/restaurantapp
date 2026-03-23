import { describe, it, expect, vi } from "vitest";
import { validate } from "./validate.js";
import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

describe("validate middleware", () => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
  });

  it("calls next and sets parsed body on valid input", () => {
    const req = { body: { email: "test@test.com", password: "123456" } } as Request;
    const next = vi.fn();
    const middleware = validate(schema);

    middleware(req, {} as Response, next);

    expect(next).toHaveBeenCalled();
    expect(req.body.email).toBe("test@test.com");
  });

  it("throws ZodError on invalid input", () => {
    const req = { body: { email: "not-email", password: "123" } } as Request;
    const next = vi.fn();
    const middleware = validate(schema);

    expect(() => middleware(req, {} as Response, next)).toThrow(z.ZodError);
    expect(next).not.toHaveBeenCalled();
  });

  it("strips unknown fields from body", () => {
    const req = {
      body: { email: "test@test.com", password: "123456", extra: "hack" },
    } as Request;
    const next = vi.fn();
    const middleware = validate(schema);

    middleware(req, {} as Response, next);

    expect(req.body.extra).toBeUndefined();
  });
});
