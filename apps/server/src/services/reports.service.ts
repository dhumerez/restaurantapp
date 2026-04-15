import { eq, and, gte, lte, sql } from "drizzle-orm";
import type { Db } from "@restaurant/db";
import { orders, orderItems } from "@restaurant/db";

export type ReportPeriod = "day" | "week" | "month";

function getPeriodRange(period: ReportPeriod, date = new Date()) {
  const start = new Date(date);
  const end = new Date(date);

  if (period === "day") {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (period === "week") {
    const day = start.getDay();
    start.setDate(start.getDate() - day);
    start.setHours(0, 0, 0, 0);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(end.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
  }

  return { start, end };
}

export async function getRevenueReport(
  db: Db,
  restaurantId: string,
  period: ReportPeriod
) {
  const { start, end } = getPeriodRange(period);

  const result = await db
    .select({
      totalRevenue: sql<string>`COALESCE(SUM(${orders.total}), 0)`,
      totalOrders: sql<number>`COUNT(*)`,
      avgOrderValue: sql<string>`COALESCE(AVG(${orders.total}), 0)`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.restaurantId, restaurantId),
        eq(orders.status, "served"),
        gte(orders.createdAt, start),
        lte(orders.createdAt, end)
      )
    );

  return result[0];
}

export async function getTopSellingItems(
  db: Db,
  restaurantId: string,
  period: ReportPeriod,
  limit = 10
) {
  const { start, end } = getPeriodRange(period);

  return db
    .select({
      itemName: orderItems.itemName,
      totalQuantity: sql<number>`SUM(${orderItems.quantity})`,
      totalRevenue: sql<string>`SUM(${orderItems.quantity} * ${orderItems.unitPrice})`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.restaurantId, restaurantId),
        eq(orders.status, "served"),
        gte(orders.createdAt, start),
        lte(orders.createdAt, end)
      )
    )
    .groupBy(orderItems.itemName)
    .orderBy(sql`SUM(${orderItems.quantity}) DESC`)
    .limit(limit);
}
