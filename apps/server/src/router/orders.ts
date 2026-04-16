import { z } from "zod";
import { eq, and, inArray, sql } from "drizzle-orm";
import { router, restaurantProcedure, waiterProcedure, cashierProcedure, kitchenProcedure } from "../trpc/trpc.js";
import {
  orders,
  orderItems,
  orderEvents,
  menuItems,
  recipeItems,
  ingredients,
  inventoryTransactions,
  restaurants,
} from "@restaurant/db";
import { emitter } from "../lib/emitter.js";
import { TRPCError } from "@trpc/server";

// ── Helpers ────────────────────────────────────────────────────────────────

/** Deduct ingredients for given order items (called on order place) */
async function deductIngredients(
  db: any,
  restaurantId: string,
  orderId: string,
  userId: string,
  items: Array<{ menuItemId: string; quantity: number }>
) {
  for (const item of items) {
    const recipes = await db
      .select()
      .from(recipeItems)
      .where(eq(recipeItems.menuItemId, item.menuItemId));

    for (const recipe of recipes) {
      const totalQty = Number(recipe.quantity) * item.quantity;

      await db
        .update(ingredients)
        .set({
          currentStock: sql`${ingredients.currentStock} - ${totalQty}`,
          updatedAt: new Date(),
        })
        .where(eq(ingredients.id, recipe.ingredientId));

      await db.insert(inventoryTransactions).values({
        restaurantId,
        ingredientId: recipe.ingredientId,
        type: "usage",
        quantity: String(-totalQty),
        orderId,
        createdBy: userId,
      });

      // Check for low stock alert
      const [ing] = await db
        .select()
        .from(ingredients)
        .where(eq(ingredients.id, recipe.ingredientId));
      if (ing && Number(ing.currentStock) <= Number(ing.minStock)) {
        emitter.emitInventoryLowStock(restaurantId, {
          ingredient: {
            id: ing.id,
            name: ing.name,
            unit: ing.unit,
            currentStock: ing.currentStock,
            minStock: ing.minStock,
          },
        });
      }
    }
  }
}

/**
 * Restore ingredients for cancelled items (called on item cancel or order cancel)
 * BUG FIX: only restores items that were NOT already individually cancelled
 */
async function restoreIngredients(
  db: any,
  restaurantId: string,
  orderId: string,
  userId: string,
  _itemIds: string[] // specific order_item IDs to restore
) {
  // Find the usage transactions for this order
  const txns = await db
    .select()
    .from(inventoryTransactions)
    .where(
      and(
        eq(inventoryTransactions.orderId, orderId),
        eq(inventoryTransactions.type, "usage"),
        eq(inventoryTransactions.restaurantId, restaurantId)
      )
    );

  // Group by ingredientId and restore
  const restoreMap = new Map<string, number>();
  for (const txn of txns) {
    const existing = restoreMap.get(txn.ingredientId) ?? 0;
    restoreMap.set(txn.ingredientId, existing + Math.abs(Number(txn.quantity)));
  }

  for (const [ingredientId, qty] of restoreMap) {
    await db
      .update(ingredients)
      .set({
        currentStock: sql`${ingredients.currentStock} + ${qty}`,
        updatedAt: new Date(),
      })
      .where(eq(ingredients.id, ingredientId));

    await db.insert(inventoryTransactions).values({
      restaurantId,
      ingredientId,
      type: "adjustment",
      quantity: String(qty),
      orderId,
      notes: "Restored on order/item cancellation",
      createdBy: userId,
    });
  }

  // Delete the original usage transactions so they're not double-restored
  await db
    .delete(inventoryTransactions)
    .where(
      and(
        eq(inventoryTransactions.orderId, orderId),
        eq(inventoryTransactions.type, "usage")
      )
    );
}

/** Recalculate order totals from its items */
async function recalcOrder(db: any, orderId: string, taxRate: number) {
  const items = await db
    .select()
    .from(orderItems)
    .where(
      and(
        eq(orderItems.orderId, orderId),
        sql`${orderItems.status} != 'cancelled'`
      )
    );

  const subtotal = items.reduce(
    (sum: number, i: any) => sum + Number(i.unitPrice) * Number(i.quantity),
    0
  );
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  await db
    .update(orders)
    .set({
      subtotal: String(subtotal.toFixed(2)),
      tax: String(tax.toFixed(2)),
      total: String(total.toFixed(2)),
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));
}

// ── Router ─────────────────────────────────────────────────────────────────

export const ordersRouter = router({
  list: restaurantProcedure
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const conditions = [eq(orders.restaurantId, ctx.restaurantId)];
      if (input?.status) {
        conditions.push(eq(orders.status, input.status as any));
      }
      // Waiters only see their own orders
      if (ctx.user!.role === "waiter") {
        conditions.push(eq(orders.waiterId, ctx.user!.id));
      }
      return ctx.db
        .select()
        .from(orders)
        .where(and(...conditions))
        .orderBy(orders.createdAt);
    }),

  get: restaurantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [order] = await ctx.db
        .select()
        .from(orders)
        .where(
          and(eq(orders.id, input.id), eq(orders.restaurantId, ctx.restaurantId))
        );
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });

      const items = await ctx.db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, input.id))
        .orderBy(orderItems.createdAt);

      return { ...order, items };
    }),

  create: waiterProcedure
    .input(
      z.object({
        tableId: z.string().uuid(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [order] = await ctx.db
        .insert(orders)
        .values({
          restaurantId: ctx.restaurantId,
          tableId: input.tableId,
          waiterId: ctx.user!.id,
          notes: input.notes,
          status: "draft",
        })
        .returning();

      await ctx.db.insert(orderEvents).values({
        orderId: order.id,
        userId: ctx.user!.id,
        action: "created",
      });

      return order;
    }),

  update: waiterProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        items: z.array(
          z.object({
            menuItemId: z.string().uuid(),
            quantity: z.number().int().min(1),
            notes: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [order] = await ctx.db
        .select()
        .from(orders)
        .where(
          and(eq(orders.id, input.id), eq(orders.restaurantId, ctx.restaurantId))
        );

      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      if (order.status !== "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only edit draft orders",
        });
      }

      // Delete existing items and replace
      await ctx.db.delete(orderItems).where(eq(orderItems.orderId, input.id));

      if (input.items.length > 0) {
        // Snapshot item names + prices at time of order (prevents price drift)
        const menuItemIds = input.items.map((i) => i.menuItemId);
        const menuItemRows = await ctx.db
          .select()
          .from(menuItems)
          .where(inArray(menuItems.id, menuItemIds));

        const menuMap = new Map(menuItemRows.map((m: any) => [m.id, m]));

        await ctx.db.insert(orderItems).values(
          input.items.map((item) => {
            const mi = menuMap.get(item.menuItemId);
            if (!mi)
              throw new TRPCError({
                code: "NOT_FOUND",
                message: `Menu item ${item.menuItemId} not found`,
              });
            return {
              orderId: input.id,
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              unitPrice: (mi as any).price,
              itemName: (mi as any).name,
              notes: item.notes ?? null,
            };
          })
        );
      }

      // Recalc totals — need restaurant tax rate
      const [restaurant] = await ctx.db
        .select({ taxRate: restaurants.taxRate })
        .from(restaurants)
        .where(eq(restaurants.id, ctx.restaurantId));

      await recalcOrder(ctx.db, input.id, Number(restaurant?.taxRate ?? 0));

      await ctx.db.insert(orderEvents).values({
        orderId: input.id,
        userId: ctx.user!.id,
        action: "items_updated",
      });

      return { success: true };
    }),

  place: waiterProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [order] = await ctx.db
        .select()
        .from(orders)
        .where(
          and(eq(orders.id, input.id), eq(orders.restaurantId, ctx.restaurantId))
        );

      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      if (order.status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Order already placed" });
      }

      const items = await ctx.db
        .select()
        .from(orderItems)
        .where(
          and(
            eq(orderItems.orderId, input.id),
            sql`${orderItems.status} != 'cancelled'`
          )
        );

      if (items.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot place empty order",
        });
      }

      // Deduct ingredients (if this fails, order stays draft)
      await deductIngredients(
        ctx.db,
        ctx.restaurantId,
        input.id,
        ctx.user!.id,
        items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity }))
      );

      const [updated] = await ctx.db
        .update(orders)
        .set({ status: "placed", updatedAt: new Date() })
        .where(eq(orders.id, input.id))
        .returning();

      await ctx.db.insert(orderEvents).values({
        orderId: input.id,
        userId: ctx.user!.id,
        action: "placed",
      });

      // Notify kitchen and all restaurant staff
      const fullOrder = { ...updated, items };
      emitter.emitOrderChange(ctx.restaurantId, {
        event: "placed",
        order: fullOrder as any,
      });
      emitter.emitKitchenChange(ctx.restaurantId, {
        event: "order_placed",
        order: fullOrder as any,
      });

      return updated;
    }),

  serve: restaurantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const role = ctx.user!.role;
      if (role === "kitchen") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const [order] = await ctx.db
        .select()
        .from(orders)
        .where(
          and(eq(orders.id, input.id), eq(orders.restaurantId, ctx.restaurantId))
        );

      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      if (role === "waiter" && order.waiterId !== ctx.user!.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (order.status !== "ready") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Order is not ready" });
      }

      const [updated] = await ctx.db
        .update(orders)
        .set({ status: "served", updatedAt: new Date() })
        .where(eq(orders.id, input.id))
        .returning();

      await ctx.db.insert(orderEvents).values({
        orderId: input.id,
        userId: ctx.user!.id,
        action: "served",
      });

      const items = await ctx.db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, input.id));
      emitter.emitOrderChange(ctx.restaurantId, {
        event: "served",
        order: { ...updated, items } as any,
      });

      return updated;
    }),

  cancel: restaurantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [order] = await ctx.db
        .select()
        .from(orders)
        .where(
          and(eq(orders.id, input.id), eq(orders.restaurantId, ctx.restaurantId))
        );

      if (!order) throw new TRPCError({ code: "NOT_FOUND" });

      const role = ctx.user!.role;
      // Waiters can only cancel their own orders
      if (role === "waiter" && order.waiterId !== ctx.user!.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      // Kitchen cannot cancel
      if (role === "kitchen") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const terminalStates = ["served", "cancelled"];
      if (terminalStates.includes(order.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Order already in terminal state",
        });
      }

      // BUG FIX: Only restore stock for items NOT already individually cancelled
      // by the kitchen. Do NOT double-restore.
      if (order.status !== "draft") {
        const activeItems = await ctx.db
          .select()
          .from(orderItems)
          .where(
            and(
              eq(orderItems.orderId, input.id),
              sql`${orderItems.status} != 'cancelled'`
            )
          );

        if (activeItems.length > 0) {
          await restoreIngredients(
            ctx.db,
            ctx.restaurantId,
            input.id,
            ctx.user!.id,
            activeItems.map((i: any) => i.id)
          );
        }
      }

      // Cancel all non-cancelled items
      await ctx.db
        .update(orderItems)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(orderItems.orderId, input.id),
            sql`${orderItems.status} != 'cancelled'`
          )
        );

      const [updated] = await ctx.db
        .update(orders)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(orders.id, input.id))
        .returning();

      await ctx.db.insert(orderEvents).values({
        orderId: input.id,
        userId: ctx.user!.id,
        action: "cancelled",
        details: { reason: input.reason ?? null },
      });

      const items = await ctx.db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, input.id));
      emitter.emitOrderChange(ctx.restaurantId, {
        event: "cancelled",
        order: { ...updated, items } as any,
      });
      emitter.emitKitchenChange(ctx.restaurantId, {
        event: "order_cancelled",
        order: { ...updated, items } as any,
      });

      return updated;
    }),

  applyDiscount: cashierProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        type: z.enum(["none", "percentage", "fixed"]),
        value: z.number().min(0),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [order] = await ctx.db
        .select()
        .from(orders)
        .where(
          and(eq(orders.id, input.id), eq(orders.restaurantId, ctx.restaurantId))
        );

      if (!order) throw new TRPCError({ code: "NOT_FOUND" });

      const subtotal = Number(order.subtotal);
      let discountAmount = 0;
      if (input.type === "percentage") discountAmount = subtotal * (input.value / 100);
      if (input.type === "fixed") discountAmount = Math.min(input.value, subtotal);

      const [updated] = await ctx.db
        .update(orders)
        .set({
          discountType: input.type,
          discountValue: String(input.value),
          discountAmount: String(discountAmount.toFixed(2)),
          discountReason: input.reason ?? null,
          total: String(
            (subtotal + Number(order.tax) - discountAmount).toFixed(2)
          ),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, input.id))
        .returning();

      await ctx.db.insert(orderEvents).values({
        orderId: input.id,
        userId: ctx.user!.id,
        action: "discount_applied",
        details: { type: input.type, value: input.value, amount: discountAmount },
      });

      return updated;
    }),

  events: router({
    list: restaurantProcedure
      .input(z.object({ orderId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        return ctx.db
          .select()
          .from(orderEvents)
          .where(eq(orderEvents.orderId, input.orderId))
          .orderBy(orderEvents.createdAt);
      }),
  }),
});
