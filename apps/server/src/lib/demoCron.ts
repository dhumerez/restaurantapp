import cron from "node-cron";
import { db } from "./db.js";
import { orders, ingredients, restaurants } from "@restaurant/db";
import { eq, sql } from "drizzle-orm";

export function startDemoCron() {
  cron.schedule("0 */2 * * *", async () => {
    console.log("[demoCron] Resetting demo restaurant...");
    try {
      const [demoRestaurant] = await db
        .select()
        .from(restaurants)
        .where(eq(restaurants.status, "demo"));

      if (!demoRestaurant) return;
      const rid = demoRestaurant.id;

      // Clear orders (cascade deletes order_items, order_events)
      await db.delete(orders).where(eq(orders.restaurantId, rid));

      // Reset ingredient stock to 5x minimum
      await db
        .update(ingredients)
        .set({ currentStock: sql`${ingredients.minStock} * 5`, updatedAt: new Date() })
        .where(eq(ingredients.restaurantId, rid));

      console.log("[demoCron] Demo reset complete");
    } catch (err) {
      console.error("[demoCron] Error:", err);
    }
  });
}
