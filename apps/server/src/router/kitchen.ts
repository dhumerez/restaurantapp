import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { router, kitchenProcedure } from "../trpc/trpc.js";
import { orders, orderItems, orderEvents, recipeItems, ingredients, inventoryTransactions } from "@restaurant/db";
import { emitter } from "../lib/emitter.js";
import { TRPCError } from "@trpc/server";
import { sendPushNotification } from "./push.js";

/** Auto-promote order status based on item states.
 *  BUG FIX: was missing order:ready emission in old app.
 *  BUG FIX: was downgrading served orders in old app.
 */
async function syncOrderStatus(
  db: any,
  orderId: string,
  restaurantId: string,
  userId: string
): Promise<void> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return;

  // Never downgrade terminal states
  if (order.status === "served" || order.status === "cancelled") return;

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const nonCancelled = items.filter((i: any) => i.status !== "cancelled");
  if (nonCancelled.length === 0) return;

  const allReady = nonCancelled.every((i: any) => i.status === "ready" || i.status === "served");
  const anyPreparing = nonCancelled.some((i: any) => i.status === "preparing");

  let newStatus: string | null = null;

  if (allReady && order.status !== "ready") {
    newStatus = "ready";
  } else if (anyPreparing && order.status === "placed") {
    newStatus = "preparing";
  }

  if (!newStatus) return;

  await db
    .update(orders)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  await db.insert(orderEvents).values({
    orderId,
    userId,
    action: "status_changed",
    details: { from: order.status, to: newStatus },
  });

  const [updatedOrder] = await db.select().from(orders).where(eq(orders.id, orderId));
  const allItems = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));

  if (newStatus === "ready") {
    emitter.emitOrderChange(restaurantId, {
      event: "ready",
      order: { ...updatedOrder, items: allItems } as any,
    });
    await sendPushNotification(db, order.waiterId, {
      title: "Order Ready",
      body: `Table order is ready to serve`,
      url: `/waiter/orders/${orderId}`,
    });
  } else {
    emitter.emitOrderChange(restaurantId, {
      event: "updated",
      order: { ...updatedOrder, items: allItems } as any,
    });
  }
}

export const kitchenRouter = router({
  activeOrders: router({
    list: kitchenProcedure.query(async ({ ctx }) => {
      const activeOrders = await ctx.db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.restaurantId, ctx.restaurantId),
            sql`${orders.status} IN ('placed', 'preparing')`
          )
        )
        .orderBy(orders.createdAt);

      const ordersWithItems = await Promise.all(
        activeOrders.map(async (order: any) => {
          const items = await ctx.db
            .select()
            .from(orderItems)
            .where(and(
              eq(orderItems.orderId, order.id),
              sql`${orderItems.status} != 'cancelled'`
            ))
            .orderBy(orderItems.createdAt);
          return { ...order, items };
        })
      );

      return ordersWithItems;
    }),
  }),

  item: router({
    updateStatus: kitchenProcedure
      .input(z.object({
        id: z.string().uuid(),
        status: z.enum(["preparing", "ready"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const [item] = await ctx.db
          .select()
          .from(orderItems)
          .where(eq(orderItems.id, input.id));

        if (!item) throw new TRPCError({ code: "NOT_FOUND" });

        const validTransitions: Record<string, string[]> = {
          pending: ["preparing"],
          preparing: ["ready"],
        };
        if (!validTransitions[item.status]?.includes(input.status)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Cannot transition from ${item.status} to ${input.status}` });
        }

        await ctx.db
          .update(orderItems)
          .set({ status: input.status })
          .where(eq(orderItems.id, input.id));

        await ctx.db.insert(orderEvents).values({
          orderId: item.orderId,
          userId: ctx.user!.id,
          action: "item_status_changed",
          details: { itemId: input.id, from: item.status, to: input.status },
        });

        const [order] = await ctx.db.select().from(orders).where(eq(orders.id, item.orderId));
        const allItems = await ctx.db.select().from(orderItems).where(eq(orderItems.orderId, item.orderId));
        emitter.emitKitchenChange(ctx.restaurantId, {
          event: "item_status_changed",
          order: { ...order, items: allItems } as any,
        });

        await syncOrderStatus(ctx.db, item.orderId, ctx.restaurantId, ctx.user!.id);

        return { success: true };
      }),

    cancel: kitchenProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const [item] = await ctx.db
          .select()
          .from(orderItems)
          .where(eq(orderItems.id, input.id));

        if (!item) throw new TRPCError({ code: "NOT_FOUND" });
        if (item.status === "cancelled" || item.status === "served") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Item cannot be cancelled" });
        }

        await ctx.db
          .update(orderItems)
          .set({ status: "cancelled" })
          .where(eq(orderItems.id, input.id));

        const recipes = await ctx.db
          .select()
          .from(recipeItems)
          .where(eq(recipeItems.menuItemId, item.menuItemId));

        for (const recipe of recipes) {
          const restoreQty = Number(recipe.quantity) * Number(item.quantity);
          await ctx.db
            .update(ingredients)
            .set({
              currentStock: sql`${ingredients.currentStock} + ${restoreQty}`,
              updatedAt: new Date(),
            })
            .where(eq(ingredients.id, recipe.ingredientId));

          await ctx.db.insert(inventoryTransactions).values({
            restaurantId: ctx.restaurantId,
            ingredientId: recipe.ingredientId,
            type: "adjustment",
            quantity: String(restoreQty),
            orderId: item.orderId,
            notes: "Restored — kitchen item cancelled",
            createdBy: ctx.user!.id,
          });

          await ctx.db
            .delete(inventoryTransactions)
            .where(
              and(
                eq(inventoryTransactions.orderId, item.orderId),
                eq(inventoryTransactions.ingredientId, recipe.ingredientId),
                eq(inventoryTransactions.type, "usage")
              )
            );
        }

        await ctx.db.insert(orderEvents).values({
          orderId: item.orderId,
          userId: ctx.user!.id,
          action: "item_status_changed",
          details: { itemId: input.id, from: item.status, to: "cancelled" },
        });

        const [order] = await ctx.db.select().from(orders).where(eq(orders.id, item.orderId));
        const allItems = await ctx.db.select().from(orderItems).where(eq(orderItems.orderId, item.orderId));
        emitter.emitKitchenChange(ctx.restaurantId, {
          event: "item_status_changed",
          order: { ...order, items: allItems } as any,
        });

        return { success: true };
      }),
  }),
});
