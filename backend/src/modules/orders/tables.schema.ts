import { z } from "zod";

export const createTableSchema = z.object({
  number: z.number().int().min(1),
  label: z.string().max(50).optional(),
  seats: z.number().int().min(1).optional(),
});

export const updateTableSchema = z.object({
  number: z.number().int().min(1).optional(),
  label: z.string().max(50).optional(),
  seats: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
});
