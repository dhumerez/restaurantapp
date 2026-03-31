import { z } from "zod";

export const updateItemStatusSchema = z.object({
  status: z.enum(["pending", "preparing", "ready", "served", "cancelled"]),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(["placed", "preparing", "ready", "served", "cancelled"]),
});
