import { eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { Db } from "@restaurant/db";
import {
  orderItems, orders, recipeItems, ingredients, inventoryTransactions,
} from "@restaurant/db";
import { syncOrderStatus } from "./orders.service.js";

export type ItemStatus = "pending" | "preparing" | "ready" | "served" | "cancelled";

export async function updateItemStatus(
  db: Db,
  orderId: string,
  itemId: string,
  newStatus: ItemStatus,
  userId: string
): Promise<{
  item: typeof orderItems.$inferSelect;
  newOrderStatus: string | null;
  orderId: string;
}> {
  const item = await db.query.orderItems.findFirst({
    where: eq(orderItems.id, itemId),
  });
  if (!item || item.orderId !== orderId) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  const wasAlreadyCancelled = item.status === "cancelled";

  // Restore stock only when transitioning TO cancelled from a non-cancelled state
  if (newStatus === "cancelled" && !wasAlreadyCancelled) {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });
    const recipes = await db.query.recipeItems.findMany({
      where: eq(recipeItems.menuItemId, item.menuItemId),
    });
    for (const recipe of recipes) {
      const restoreQty = Number(recipe.quantity) * item.quantity;
      await db
        .update(ingredients)
        .set({
          currentStock: sql`${ingredients.currentStock} + ${restoreQty}`,
          updatedAt: new Date(),
        })
        .where(eq(ingredients.id, recipe.ingredientId));
      await db.insert(inventoryTransactions).values({
        restaurantId: order!.restaurantId,
        ingredientId: recipe.ingredientId,
        type: "adjustment",
        quantity: String(restoreQty),
        orderId,
        notes: "item cancelled by kitchen",
        createdBy: userId,
      });
    }
  }

  const [updated] = await db
    .update(orderItems)
    .set({ status: newStatus })
    .where(eq(orderItems.id, itemId))
    .returning();

  const newOrderStatus = await syncOrderStatus(db, orderId);

  return { item: updated, newOrderStatus, orderId };
}
