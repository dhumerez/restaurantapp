import { z } from "zod";

export const createRestaurantSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  address: z.string().max(500).optional(),
  currency: z.string().length(3).default("USD"),
  taxRate: z.string().default("0.00"),
  // Initial admin user
  adminName: z.string().min(1).max(100),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
});

export const updateRestaurantSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  address: z.string().max(500).optional(),
  currency: z.string().length(3).optional(),
  taxRate: z.string().optional(),
  status: z.enum(["active", "trial", "suspended", "inactive"]).optional(),
});
