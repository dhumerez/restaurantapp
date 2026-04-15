import { eq, sql } from "drizzle-orm";
import type { Db } from "@restaurant/db";
import {
  ingredients, recipeItems, inventoryTransactions, orderItems,
} from "@restaurant/db";

export async function deductStockForOrder(
  db: Db,
  restaurantId: string,
  orderId: string,
  createdBy: string,
  onLowStock?: (ingredientId: string, currentStock: number) => void
): Promise<void> {
  const items = await db.query.orderItems.findMany({
    where: eq(orderItems.orderId, orderId),
  });

  for (const item of items) {
    const recipes = await db.query.recipeItems.findMany({
      where: eq(recipeItems.menuItemId, item.menuItemId),
    });

    for (const recipe of recipes) {
      const deductQty = Number(recipe.quantity) * item.quantity;

      const [updated] = await db
        .update(ingredients)
        .set({
          currentStock: sql`${ingredients.currentStock} - ${deductQty}`,
          updatedAt: new Date(),
        })
        .where(eq(ingredients.id, recipe.ingredientId))
        .returning();

      await db.insert(inventoryTransactions).values({
        restaurantId,
        ingredientId: recipe.ingredientId,
        type: "usage",
        quantity: String(-deductQty),
        orderId,
        notes: `order item: ${item.itemName}`,
        createdBy,
      });

      if (
        onLowStock &&
        Number(updated.currentStock) <= Number(updated.minStock)
      ) {
        onLowStock(updated.id, Number(updated.currentStock));
      }
    }
  }
}

export async function restoreStockForItems(
  db: Db,
  restaurantId: string,
  orderId: string,
  itemsToRestore: Array<typeof orderItems.$inferSelect>,
  createdBy: string
): Promise<void> {
  for (const item of itemsToRestore) {
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
        restaurantId,
        ingredientId: recipe.ingredientId,
        type: "adjustment",
        quantity: String(restoreQty),
        orderId,
        notes: "stock restored on order cancel",
        createdBy,
      });
    }
  }
}
