import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { orders, orderItems, menuItems, tables, restaurants } from "../../db/schema.js";
import { NotFoundError, AppError } from "../../utils/errors.js";
import type { CreateOrderInput, UpdateOrderInput } from "./orders.schema.js";

export async function listOrders(restaurantId: string, status?: string, tableId?: string, waiterId?: string) {
  const conditions = [eq(orders.restaurantId, restaurantId)];

  if (status) {
    const statuses = status.split(",") as Array<"draft" | "placed" | "preparing" | "ready" | "served" | "cancelled">;
    conditions.push(inArray(orders.status, statuses));
  }
  if (tableId) {
    conditions.push(eq(orders.tableId, tableId));
  }
  if (waiterId) {
    conditions.push(eq(orders.waiterId, waiterId));
  }

  return db.query.orders.findMany({
    where: and(...conditions),
    with: {
      items: true,
      table: true,
      waiter: {
        columns: { id: true, name: true },
      },
    },
    orderBy: (orders, { desc }) => [desc(orders.createdAt)],
  });
}

export async function getOrder(restaurantId: string, id: string) {
  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, id), eq(orders.restaurantId, restaurantId)),
    with: {
      items: {
        with: {
          menuItem: true,
        },
      },
      table: true,
      waiter: {
        columns: { id: true, name: true },
      },
    },
  });

  if (!order) throw new NotFoundError("Order not found");
  return order;
}

export async function createOrder(
  restaurantId: string,
  waiterId: string,
  input: CreateOrderInput
) {
  // Verify table belongs to restaurant
  const [table] = await db
    .select()
    .from(tables)
    .where(and(eq(tables.id, input.tableId), eq(tables.restaurantId, restaurantId)));

  if (!table) throw new NotFoundError("Table not found");

  const [order] = await db
    .insert(orders)
    .values({
      restaurantId,
      tableId: input.tableId,
      waiterId,
      notes: input.notes,
      status: "draft",
    })
    .returning();

  return order;
}

export async function updateOrder(
  restaurantId: string,
  orderId: string,
  input: UpdateOrderInput
) {
  // Verify order exists and is editable (draft or placed)
  const [order] = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.id, orderId),
        eq(orders.restaurantId, restaurantId),
        inArray(orders.status, ["draft", "placed"])
      )
    );

  if (!order) throw new NotFoundError("Order not found or cannot be edited");

  // Fetch menu items for pricing
  const menuItemIds = input.items.map((i) => i.menuItemId);
  const menuItemRows = await db
    .select()
    .from(menuItems)
    .where(
      and(eq(menuItems.restaurantId, restaurantId), inArray(menuItems.id, menuItemIds))
    );

  const menuItemMap = new Map(menuItemRows.map((m) => [m.id, m]));

  // Validate all items exist and are available
  for (const item of input.items) {
    const mi = menuItemMap.get(item.menuItemId);
    if (!mi) throw new NotFoundError(`Menu item ${item.menuItemId} not found`);
    if (!mi.isAvailable) throw new AppError(400, `${mi.name} is not available`);
  }

  if (order.status === "placed") {
    // Adjust stock for placed orders: compare old vs new quantities
    const currentItems = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    const oldQtyMap = new Map(currentItems.map((i) => [i.menuItemId, i.quantity]));
    const newQtyMap = new Map(input.items.map((i) => [i.menuItemId, i.quantity]));
    const allItemIds = new Set([...oldQtyMap.keys(), ...newQtyMap.keys()]);

    for (const itemId of allItemIds) {
      const oldQty = oldQtyMap.get(itemId) ?? 0;
      const newQty = newQtyMap.get(itemId) ?? 0;
      const delta = newQty - oldQty;
      if (delta === 0) continue;

      const [mi] = await db.select().from(menuItems).where(eq(menuItems.id, itemId));
      if (!mi || mi.stockCount === null) continue;

      if (delta > 0 && mi.stockCount < delta) {
        throw new AppError(400, `${mi.name} only has ${mi.stockCount} left in stock`);
      }

      await db
        .update(menuItems)
        .set({ stockCount: sql`${menuItems.stockCount} - ${delta}`, updatedAt: new Date() })
        .where(eq(menuItems.id, itemId));
    }
  } else {
    // Draft: validate stock normally
    for (const item of input.items) {
      const mi = menuItemMap.get(item.menuItemId)!;
      if (mi.stockCount !== null && mi.stockCount < item.quantity) {
        throw new AppError(400, `${mi.name} only has ${mi.stockCount} left in stock`);
      }
    }
  }

  // Replace items
  await db.delete(orderItems).where(eq(orderItems.orderId, orderId));

  const newItems = input.items.map((item) => {
    const mi = menuItemMap.get(item.menuItemId)!;
    return {
      orderId,
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      unitPrice: mi.price,
      itemName: mi.name,
      notes: item.notes,
      // Keep items as pending so kitchen sees updates
      ...(order.status === "placed" && { status: "pending" as const }),
    };
  });

  await db.insert(orderItems).values(newItems);

  // Calculate totals
  const subtotal = input.items.reduce((sum, item) => {
    const mi = menuItemMap.get(item.menuItemId)!;
    return sum + parseFloat(mi.price) * item.quantity;
  }, 0);

  // Get restaurant tax rate
  const [restaurant] = await db
    .select()
    .from(restaurants)
    .where(eq(restaurants.id, restaurantId));

  const taxRate = parseFloat(restaurant.taxRate);
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  const [updated] = await db
    .update(orders)
    .set({
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2),
      notes: input.notes,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId))
    .returning();

  return getOrder(restaurantId, updated.id);
}

export async function placeOrder(restaurantId: string, orderId: string) {
  const order = await getOrder(restaurantId, orderId);

  if (order.status !== "draft") {
    throw new AppError(400, "Only draft orders can be placed");
  }
  if (order.items.length === 0) {
    throw new AppError(400, "Cannot place an empty order");
  }

  // Decrement stock for items with stock tracking
  for (const item of order.items) {
    if (item.menuItem && item.menuItem.stockCount !== null) {
      await db
        .update(menuItems)
        .set({
          stockCount: sql`${menuItems.stockCount} - ${item.quantity}`,
          updatedAt: new Date(),
        })
        .where(eq(menuItems.id, item.menuItemId));
    }
  }

  // Update order status
  const [updated] = await db
    .update(orders)
    .set({ status: "placed", updatedAt: new Date() })
    .where(eq(orders.id, orderId))
    .returning();

  // Update all items to pending
  await db
    .update(orderItems)
    .set({ status: "pending" })
    .where(eq(orderItems.orderId, orderId));

  return getOrder(restaurantId, updated.id);
}

export async function serveOrder(restaurantId: string, orderId: string) {
  const order = await getOrder(restaurantId, orderId);

  if (order.status !== "ready") {
    throw new AppError(400, "Only ready orders can be marked as served");
  }

  await db
    .update(orders)
    .set({ status: "served", updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  await db
    .update(orderItems)
    .set({ status: "served" })
    .where(eq(orderItems.orderId, orderId));

  return getOrder(restaurantId, orderId);
}

export async function cancelOrder(restaurantId: string, orderId: string) {
  const order = await getOrder(restaurantId, orderId);

  if (order.status === "served" || order.status === "cancelled") {
    throw new AppError(400, "Cannot cancel this order");
  }

  // Restore stock for placed orders
  if (order.status !== "draft") {
    for (const item of order.items) {
      if (item.menuItem && item.menuItem.stockCount !== null) {
        await db
          .update(menuItems)
          .set({
            stockCount: sql`${menuItems.stockCount} + ${item.quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(menuItems.id, item.menuItemId));
      }
    }
  }

  await db
    .update(orders)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  await db
    .update(orderItems)
    .set({ status: "cancelled" })
    .where(eq(orderItems.orderId, orderId));

  return getOrder(restaurantId, orderId);
}
