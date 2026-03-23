import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().min(1).max(255),
  sortOrder: z.number().int().default(0),
});

export const updateCategorySchema = createCategorySchema.partial();

export const createMenuItemSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  price: z.number().positive(),
  imageUrl: z.string().url().optional(),
  stockCount: z.number().int().min(0).nullable().default(null),
  isAvailable: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const updateMenuItemSchema = createMenuItemSchema.partial();

export const updateStockSchema = z.object({
  stockCount: z.number().int().min(0).nullable(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;
