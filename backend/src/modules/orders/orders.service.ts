import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { orders, orderItems, menuItems, tables, restaurants } from "../../db/schema.js";
import { NotFoundError, AppError } from "../../utils/errors.js";
import type { CreateOrderInput, UpdateOrderInput, ApplyDiscountInput, TransferOrderInput } from "./orders.schema.js";

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

  // Preserve existing discount
  const discountType = order.discountType ?? "none";
  const discountValue = parseFloat(order.discountValue ?? "0");
  const discountAmount = calcDiscountAmount(discountType, discountValue, subtotal);
  const discountedSubtotal = subtotal - discountAmount;
  const tax = discountedSubtotal * (taxRate / 100);
  const total = discountedSubtotal + tax;

  const [updated] = await db
    .update(orders)
    .set({
      subtotal: subtotal.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
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

  await db.transaction(async (tx) => {
    // Decrement stock for items with stock tracking
    for (const item of order.items) {
      if (item.menuItem && item.menuItem.stockCount !== null) {
        const [updated] = await tx
          .update(menuItems)
          .set({
            stockCount: sql`${menuItems.stockCount} - ${item.quantity}`,
            updatedAt: new Date(),
          })
          .where(and(eq(menuItems.id, item.menuItemId), sql`${menuItems.stockCount} >= ${item.quantity}`))
          .returning();

        if (!updated) {
          throw new AppError(400, `${item.menuItem.name} does not have enough stock`);
        }
      }
    }

    // Update order status
    await tx
      .update(orders)
      .set({ status: "placed", updatedAt: new Date() })
      .where(eq(orders.id, orderId));

    // Update all items to pending
    await tx
      .update(orderItems)
      .set({ status: "pending" })
      .where(eq(orderItems.orderId, orderId));
  });

  return getOrder(restaurantId, orderId);
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

function calcDiscountAmount(type: string, value: number, subtotal: number): number {
  if (type === "percentage") return Math.min(subtotal, subtotal * (value / 100));
  if (type === "fixed") return Math.min(subtotal, value);
  return 0;
}

export async function applyDiscount(restaurantId: string, orderId: string, input: ApplyDiscountInput) {
  const order = await getOrder(restaurantId, orderId);

  if (order.status === "cancelled") {
    throw new AppError(400, "Cannot apply discount to a cancelled order");
  }
  if (order.status === "draft") {
    throw new AppError(400, "Cannot apply discount to a draft order");
  }

  const subtotal = parseFloat(order.subtotal);

  if (input.discountType === "percentage" && input.discountValue > 100) {
    throw new AppError(400, "Percentage discount cannot exceed 100%");
  }
  if (input.discountType === "fixed" && input.discountValue > subtotal) {
    throw new AppError(400, "Fixed discount cannot exceed subtotal");
  }

  const discountAmount = calcDiscountAmount(input.discountType, input.discountValue, subtotal);
  const discountedSubtotal = subtotal - discountAmount;

  // Get restaurant tax rate
  const [restaurant] = await db
    .select()
    .from(restaurants)
    .where(eq(restaurants.id, restaurantId));

  const taxRate = parseFloat(restaurant.taxRate);
  const tax = discountedSubtotal * (taxRate / 100);
  const total = discountedSubtotal + tax;

  await db
    .update(orders)
    .set({
      discountType: input.discountType,
      discountValue: input.discountValue.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      discountReason: input.discountReason ?? null,
      tax: tax.toFixed(2),
      total: total.toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  return getOrder(restaurantId, orderId);
}

export async function transferOrder(restaurantId: string, orderId: string, input: TransferOrderInput) {
  const order = await getOrder(restaurantId, orderId);

  const transferable = ["draft", "placed", "preparing", "ready"];
  if (!transferable.includes(order.status)) {
    throw new AppError(400, "Only active orders can be transferred");
  }

  // Verify target table belongs to restaurant
  const [table] = await db
    .select()
    .from(tables)
    .where(and(eq(tables.id, input.tableId), eq(tables.restaurantId, restaurantId)));

  if (!table) throw new NotFoundError("Target table not found");

  if (order.tableId === input.tableId) {
    throw new AppError(400, "Order is already at this table");
  }

  await db
    .update(orders)
    .set({ tableId: input.tableId, updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  return getOrder(restaurantId, orderId);
}

export async function mergeOrders(restaurantId: string, sourceId: string, targetId: string) {
  const source = await getOrder(restaurantId, sourceId);
  const target = await getOrder(restaurantId, targetId);

  const mergeable = ["placed", "preparing", "ready"];
  if (!mergeable.includes(source.status)) {
    throw new AppError(400, "Source order must be placed, preparing, or ready");
  }
  if (!mergeable.includes(target.status)) {
    throw new AppError(400, "Target order must be placed, preparing, or ready");
  }

  if (sourceId === targetId) {
    throw new AppError(400, "Cannot merge an order with itself");
  }

  await db.transaction(async (tx) => {
    // Move all non-cancelled items from source to target
    const sourceItems = source.items.filter((i) => i.status !== "cancelled");

    for (const item of sourceItems) {
      await tx
        .update(orderItems)
        .set({ orderId: targetId })
        .where(eq(orderItems.id, item.id));
    }

    // Recalculate target totals
    const allTargetItems = await tx
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.orderId, targetId), sql`${orderItems.status} != 'cancelled'`));

    const subtotal = allTargetItems.reduce(
      (sum, item) => sum + parseFloat(item.unitPrice) * item.quantity,
      0
    );

    // Get restaurant tax rate
    const [restaurant] = await tx
      .select()
      .from(restaurants)
      .where(eq(restaurants.id, restaurantId));

    const taxRate = parseFloat(restaurant.taxRate);

    // Preserve target's discount
    const discountType = target.discountType ?? "none";
    const discountValue = parseFloat(target.discountValue ?? "0");
    const discountAmount = calcDiscountAmount(discountType, discountValue, subtotal);
    const discountedSubtotal = subtotal - discountAmount;
    const tax = discountedSubtotal * (taxRate / 100);
    const total = discountedSubtotal + tax;

    await tx
      .update(orders)
      .set({
        subtotal: subtotal.toFixed(2),
        discountAmount: discountAmount.toFixed(2),
        tax: tax.toFixed(2),
        total: total.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, targetId));

    // Cancel the source order (no stock restore — items were moved, not cancelled)
    await tx
      .update(orders)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(orders.id, sourceId));
  });

  return getOrder(restaurantId, targetId);
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
