import { Request, Response } from "express";
import { sql, eq, and, gte, lte, ne } from "drizzle-orm";
import { db } from "../../config/db.js";
import { orders, orderItems, users } from "../../db/schema.js";

function parseDateRange(req: Request): { from: Date; to: Date } {
  const now = new Date();
  const from = req.query.from ? new Date(req.query.from as string) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = req.query.to ? new Date(req.query.to as string) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { from, to };
}

export async function getSummary(req: Request, res: Response) {
  const restaurantId = req.user!.restaurantId;
  const { from, to } = parseDateRange(req);

  const result = await db
    .select({
      totalOrders: sql<number>`count(*)::int`,
      totalRevenue: sql<string>`coalesce(sum(${orders.total}), 0)`,
      avgTicket: sql<string>`coalesce(avg(${orders.total}), 0)`,
      totalItems: sql<number>`coalesce(sum((select sum(${orderItems.quantity}) from ${orderItems} where ${orderItems.orderId} = ${orders.id} and ${orderItems.status} != 'cancelled'))::int, 0)`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.restaurantId, restaurantId),
        ne(orders.status, "cancelled"),
        ne(orders.status, "draft"),
        gte(orders.createdAt, from),
        lte(orders.createdAt, to)
      )
    );

  const row = result[0];
  res.json({
    totalOrders: row.totalOrders,
    totalRevenue: parseFloat(row.totalRevenue).toFixed(2),
    avgTicket: parseFloat(row.avgTicket).toFixed(2),
    totalItems: row.totalItems,
  });
}

export async function getTopItems(req: Request, res: Response) {
  const restaurantId = req.user!.restaurantId;
  const { from, to } = parseDateRange(req);
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

  const result = await db
    .select({
      itemName: orderItems.itemName,
      totalQuantity: sql<number>`sum(${orderItems.quantity})::int`,
      totalRevenue: sql<string>`sum(${orderItems.unitPrice} * ${orderItems.quantity})`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.restaurantId, restaurantId),
        ne(orders.status, "cancelled"),
        ne(orders.status, "draft"),
        ne(orderItems.status, "cancelled"),
        gte(orders.createdAt, from),
        lte(orders.createdAt, to)
      )
    )
    .groupBy(orderItems.itemName)
    .orderBy(sql`sum(${orderItems.quantity}) desc`)
    .limit(limit);

  res.json(
    result.map((r) => ({
      itemName: r.itemName,
      totalQuantity: r.totalQuantity,
      totalRevenue: parseFloat(r.totalRevenue).toFixed(2),
    }))
  );
}

export async function getRevenueByPeriod(req: Request, res: Response) {
  const restaurantId = req.user!.restaurantId;
  const { from, to } = parseDateRange(req);
  const group = (req.query.group as string) || "day";

  const truncExpr =
    group === "month"
      ? sql`date_trunc('month', ${orders.createdAt})`
      : group === "week"
        ? sql`date_trunc('week', ${orders.createdAt})`
        : sql`date_trunc('day', ${orders.createdAt})`;

  const result = await db
    .select({
      period: sql<string>`${truncExpr}`,
      revenue: sql<string>`coalesce(sum(${orders.total}), 0)`,
      orderCount: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.restaurantId, restaurantId),
        ne(orders.status, "cancelled"),
        ne(orders.status, "draft"),
        gte(orders.createdAt, from),
        lte(orders.createdAt, to)
      )
    )
    .groupBy(truncExpr)
    .orderBy(truncExpr);

  res.json(
    result.map((r) => ({
      period: r.period,
      revenue: parseFloat(r.revenue).toFixed(2),
      orderCount: r.orderCount,
    }))
  );
}

export async function getByWaiter(req: Request, res: Response) {
  const restaurantId = req.user!.restaurantId;
  const { from, to } = parseDateRange(req);

  const result = await db
    .select({
      waiterId: orders.waiterId,
      waiterName: users.name,
      totalOrders: sql<number>`count(*)::int`,
      totalRevenue: sql<string>`coalesce(sum(${orders.total}), 0)`,
      avgTicket: sql<string>`coalesce(avg(${orders.total}), 0)`,
    })
    .from(orders)
    .innerJoin(users, eq(orders.waiterId, users.id))
    .where(
      and(
        eq(orders.restaurantId, restaurantId),
        ne(orders.status, "cancelled"),
        ne(orders.status, "draft"),
        gte(orders.createdAt, from),
        lte(orders.createdAt, to)
      )
    )
    .groupBy(orders.waiterId, users.name)
    .orderBy(sql`sum(${orders.total}) desc`);

  res.json(
    result.map((r) => ({
      waiterId: r.waiterId,
      waiterName: r.waiterName,
      totalOrders: r.totalOrders,
      totalRevenue: parseFloat(r.totalRevenue).toFixed(2),
      avgTicket: parseFloat(r.avgTicket).toFixed(2),
    }))
  );
}

export async function getByHour(req: Request, res: Response) {
  const restaurantId = req.user!.restaurantId;
  const { from, to } = parseDateRange(req);

  const result = await db
    .select({
      hour: sql<number>`extract(hour from ${orders.createdAt})::int`,
      orderCount: sql<number>`count(*)::int`,
      revenue: sql<string>`coalesce(sum(${orders.total}), 0)`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.restaurantId, restaurantId),
        ne(orders.status, "cancelled"),
        ne(orders.status, "draft"),
        gte(orders.createdAt, from),
        lte(orders.createdAt, to)
      )
    )
    .groupBy(sql`extract(hour from ${orders.createdAt})`)
    .orderBy(sql`extract(hour from ${orders.createdAt})`);

  res.json(
    result.map((r) => ({
      hour: r.hour,
      orderCount: r.orderCount,
      revenue: parseFloat(r.revenue).toFixed(2),
    }))
  );
}
