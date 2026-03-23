import { eq, and, inArray } from "drizzle-orm";
import { db } from "../../config/db.js";
import { orders, orderItems } from "../../db/schema.js";
import { NotFoundError, AppError } from "../../utils/errors.js";

export async function getActiveOrders(restaurantId: string) {
  return db.query.orders.findMany({
    where: and(
      eq(orders.restaurantId, restaurantId),
      inArray(orders.status, ["placed", "preparing", "ready"])
    ),
    with: {
      items: true,
      table: true,
      waiter: {
        columns: { id: true, name: true },
      },
    },
    orderBy: (orders, { asc }) => [asc(orders.createdAt)],
  });
}

export async function updateItemStatus(
  restaurantId: string,
  itemId: string,
  status: "preparing" | "ready" | "served" | "cancelled"
) {
  // Get the item and verify it belongs to this restaurant
  const item = await db.query.orderItems.findFirst({
    where: eq(orderItems.id, itemId),
    with: {
      order: true,
    },
  });

  if (!item || item.order.restaurantId !== restaurantId) {
    throw new NotFoundError("Order item not found");
  }

  const [updated] = await db
    .update(orderItems)
    .set({ status })
    .where(eq(orderItems.id, itemId))
    .returning();

  // Auto-update order status based on items
  await syncOrderStatus(item.orderId);

  return updated;
}

export async function updateOrderStatus(
  restaurantId: string,
  orderId: string,
  status: "preparing" | "ready" | "served"
) {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.restaurantId, restaurantId)));

  if (!order) throw new NotFoundError("Order not found");

  const validTransitions: Record<string, string[]> = {
    placed: ["preparing"],
    preparing: ["ready"],
    ready: ["served"],
  };

  if (!validTransitions[order.status]?.includes(status)) {
    throw new AppError(400, `Cannot transition from ${order.status} to ${status}`);
  }

  const [updated] = await db
    .update(orders)
    .set({ status, updatedAt: new Date() })
    .where(eq(orders.id, orderId))
    .returning();

  return updated;
}

async function syncOrderStatus(orderId: string) {
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const statuses = items.map((i) => i.status);

  let newStatus: "preparing" | "ready" | null = null;

  if (statuses.every((s) => s === "ready" || s === "served")) {
    newStatus = "ready";
  } else if (statuses.some((s) => s === "preparing")) {
    newStatus = "preparing";
  }

  if (newStatus) {
    await db
      .update(orders)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(orders.id, orderId));
  }
}
