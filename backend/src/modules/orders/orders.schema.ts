import { z } from "zod";

export const createOrderSchema = z.object({
  tableId: z.string().uuid(),
  notes: z.string().optional(),
});

export const orderItemSchema = z.object({
  menuItemId: z.string().uuid(),
  quantity: z.number().int().min(1),
  notes: z.string().optional(),
});

export const updateOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1),
  notes: z.string().optional(),
});

export const applyDiscountSchema = z.object({
  discountType: z.enum(["none", "percentage", "fixed"]),
  discountValue: z.number().min(0),
  discountReason: z.string().optional(),
});

export const transferOrderSchema = z.object({
  tableId: z.string().uuid(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type ApplyDiscountInput = z.infer<typeof applyDiscountSchema>;
export type TransferOrderInput = z.infer<typeof transferOrderSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;
