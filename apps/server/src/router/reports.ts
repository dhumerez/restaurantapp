import { z } from "zod";
import { sql, and, gte, lte, eq } from "drizzle-orm";
import { router, adminProcedure } from "../trpc/trpc.js";
import { orders, orderItems, inventoryTransactions, ingredients, user } from "@restaurant/db";

const periodSchema = z.enum(["day", "week", "month"]);

function getPeriodRange(period: "day" | "week" | "month"): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  let start: Date;

  if (period === "day") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  } else if (period === "week") {
    const day = now.getDay();
    const diff = (day === 0 ? -6 : 1 - day); // Monday start
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff, 0, 0, 0);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
  }

  return { start, end };
}

export const reportsRouter = router({
  orders: router({
    summary: adminProcedure
      .input(z.object({ period: periodSchema }))
      .query(async ({ ctx, input }) => {
        const { start, end } = getPeriodRange(input.period);

        const result = await ctx.db
          .select({
            totalOrders: sql<number>`count(*)`,
            totalRevenue: sql<string>`sum(${orders.total})`,
            totalSubtotal: sql<string>`sum(${orders.subtotal})`,
            totalTax: sql<string>`sum(${orders.tax})`,
            totalDiscounts: sql<string>`sum(${orders.discountAmount})`,
          })
          .from(orders)
          .where(
            and(
              eq(orders.restaurantId, ctx.restaurantId),
              sql`${orders.status} NOT IN ('draft', 'cancelled')`,
              gte(orders.createdAt, start),
              lte(orders.createdAt, end)
            )
          );

        return result[0];
      }),

    byWaiter: adminProcedure
      .input(z.object({ period: periodSchema }))
      .query(async ({ ctx, input }) => {
        const { start, end } = getPeriodRange(input.period);

        return ctx.db
          .select({
            waiterId: orders.waiterId,
            waiterName: user.name,
            orderCount: sql<number>`count(*)`,
            totalRevenue: sql<string>`sum(${orders.total})`,
          })
          .from(orders)
          .leftJoin(user, eq(orders.waiterId, user.id))
          .where(
            and(
              eq(orders.restaurantId, ctx.restaurantId),
              sql`${orders.status} NOT IN ('draft', 'cancelled')`,
              gte(orders.createdAt, start),
              lte(orders.createdAt, end)
            )
          )
          .groupBy(orders.waiterId, user.name)
          .orderBy(sql`sum(${orders.total}) DESC`);
      }),

    byHour: adminProcedure
      .input(z.object({ period: periodSchema }))
      .query(async ({ ctx, input }) => {
        const { start, end } = getPeriodRange(input.period);

        return ctx.db
          .select({
            hour: sql<number>`EXTRACT(HOUR FROM ${orders.createdAt})`,
            orderCount: sql<number>`count(*)`,
            totalRevenue: sql<string>`sum(${orders.total})`,
          })
          .from(orders)
          .where(
            and(
              eq(orders.restaurantId, ctx.restaurantId),
              sql`${orders.status} NOT IN ('draft', 'cancelled')`,
              gte(orders.createdAt, start),
              lte(orders.createdAt, end)
            )
          )
          .groupBy(sql`EXTRACT(HOUR FROM ${orders.createdAt})`)
          .orderBy(sql`EXTRACT(HOUR FROM ${orders.createdAt})`);
      }),

    topItems: adminProcedure
      .input(z.object({ period: periodSchema, limit: z.number().int().default(10) }))
      .query(async ({ ctx, input }) => {
        const { start, end } = getPeriodRange(input.period);

        return ctx.db
          .select({
            itemName: orderItems.itemName,
            totalQuantity: sql<number>`sum(${orderItems.quantity})`,
            totalRevenue: sql<string>`sum(${orderItems.quantity} * ${orderItems.unitPrice})`,
          })
          .from(orderItems)
          .leftJoin(orders, eq(orderItems.orderId, orders.id))
          .where(
            and(
              eq(orders.restaurantId, ctx.restaurantId),
              sql`${orders.status} NOT IN ('draft', 'cancelled')`,
              sql`${orderItems.status} != 'cancelled'`,
              gte(orders.createdAt, start),
              lte(orders.createdAt, end)
            )
          )
          .groupBy(orderItems.itemName)
          .orderBy(sql`sum(${orderItems.quantity}) DESC`)
          .limit(input.limit);
      }),

    revenue: adminProcedure
      .input(z.object({ period: periodSchema }))
      .query(async ({ ctx, input }) => {
        const { start, end } = getPeriodRange(input.period);

        const groupByExpr = input.period === "day"
          ? sql`DATE_TRUNC('hour', ${orders.createdAt})`
          : sql`DATE_TRUNC('day', ${orders.createdAt})`;

        return ctx.db
          .select({
            period: groupByExpr,
            orderCount: sql<number>`count(*)`,
            revenue: sql<string>`sum(${orders.total})`,
          })
          .from(orders)
          .where(
            and(
              eq(orders.restaurantId, ctx.restaurantId),
              sql`${orders.status} NOT IN ('draft', 'cancelled')`,
              gte(orders.createdAt, start),
              lte(orders.createdAt, end)
            )
          )
          .groupBy(groupByExpr)
          .orderBy(groupByExpr);
      }),
  }),

  inventory: router({
    usage: adminProcedure
      .input(z.object({ period: periodSchema }))
      .query(async ({ ctx, input }) => {
        const { start, end } = getPeriodRange(input.period);

        return ctx.db
          .select({
            ingredientId: inventoryTransactions.ingredientId,
            ingredientName: ingredients.name,
            unit: ingredients.unit,
            totalUsed: sql<string>`ABS(sum(CASE WHEN ${inventoryTransactions.type} = 'usage' THEN ${inventoryTransactions.quantity} ELSE 0 END))`,
            totalWasted: sql<string>`ABS(sum(CASE WHEN ${inventoryTransactions.type} = 'waste' THEN ${inventoryTransactions.quantity} ELSE 0 END))`,
          })
          .from(inventoryTransactions)
          .leftJoin(ingredients, eq(inventoryTransactions.ingredientId, ingredients.id))
          .where(
            and(
              eq(inventoryTransactions.restaurantId, ctx.restaurantId),
              gte(inventoryTransactions.createdAt, start),
              lte(inventoryTransactions.createdAt, end)
            )
          )
          .groupBy(inventoryTransactions.ingredientId, ingredients.name, ingredients.unit)
          .orderBy(sql`ABS(sum(CASE WHEN ${inventoryTransactions.type} = 'usage' THEN ${inventoryTransactions.quantity} ELSE 0 END)) DESC`);
      }),

    cost: adminProcedure
      .input(z.object({ period: periodSchema }))
      .query(async ({ ctx, input }) => {
        const { start, end } = getPeriodRange(input.period);

        return ctx.db
          .select({
            ingredientId: inventoryTransactions.ingredientId,
            ingredientName: ingredients.name,
            unit: ingredients.unit,
            costPerUnit: ingredients.costPerUnit,
            totalUsed: sql<string>`ABS(sum(CASE WHEN ${inventoryTransactions.type} = 'usage' THEN ${inventoryTransactions.quantity} ELSE 0 END))`,
            totalCost: sql<string>`ABS(sum(CASE WHEN ${inventoryTransactions.type} = 'usage' THEN ${inventoryTransactions.quantity} ELSE 0 END)) * ${ingredients.costPerUnit}`,
          })
          .from(inventoryTransactions)
          .leftJoin(ingredients, eq(inventoryTransactions.ingredientId, ingredients.id))
          .where(
            and(
              eq(inventoryTransactions.restaurantId, ctx.restaurantId),
              gte(inventoryTransactions.createdAt, start),
              lte(inventoryTransactions.createdAt, end)
            )
          )
          .groupBy(inventoryTransactions.ingredientId, ingredients.name, ingredients.unit, ingredients.costPerUnit)
          .orderBy(sql`ABS(sum(CASE WHEN ${inventoryTransactions.type} = 'usage' THEN ${inventoryTransactions.quantity} ELSE 0 END)) * ${ingredients.costPerUnit} DESC`);
      }),

    lowStock: adminProcedure.query(async ({ ctx }) => {
      return ctx.db
        .select()
        .from(ingredients)
        .where(
          and(
            eq(ingredients.restaurantId, ctx.restaurantId),
            sql`${ingredients.currentStock} <= ${ingredients.minStock}`
          )
        )
        .orderBy(sql`${ingredients.currentStock} / NULLIF(${ingredients.minStock}, 0) ASC`);
    }),
  }),
});
