import { z } from "zod";

export const createStaffSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["admin", "waiter", "kitchen"]),
});

export const updateStaffSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(["admin", "waiter", "kitchen"]).optional(),
  isActive: z.boolean().optional(),
});
