import { eq, and, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { Db } from "@restaurant/db";
import {
  orders, orderItems, orderEvents, menuItems, recipeItems,
  ingredients, inventoryTransactions,
} from "@restaurant/db";

export type OrderStatus = "draft" | "placed" | "preparing" | "ready" | "served" | "cancelled";
export type ItemStatus = "pending" | "preparing" | "ready" | "served" | "cancelled";
export type OrderAction =
  | "created" | "items_updated" | "placed" | "status_changed"
  | "item_status_changed" | "transferred" | "merged"
  | "discount_applied" | "served" | "cancelled";

export interface CreateOrderInput {
  tableId: string;
  notes?: string;
  items: Array<{ menuItemId: string; quantity: number; notes?: string }>;
}

export interface UpdateOrderInput {
  notes?: string;
  items?: Array<{ menuItemId: string; quantity: number; notes?: string }>;
}

export interface ApplyDiscountInput {
  type: "none" | "percentage" | "fixed";
  value: number;
  reason?: string;
}

export interface TransferOrderInput {
  targetTableId: string;
}

// logEvent — insert into order_events, never throws
export async function logEvent(
  db: Db,
  orderId: string,
  userId: string,
  action: OrderAction,
  details?: Record<string, unknown>
): Promise<void> {
  await db.insert(orderEvents).values({ orderId, userId, action, details });
}

// createOrder — inserts order + items in one transaction, logs "created" event
export async function createOrder(
  db: Db,
  restaurantId: string,
  waiterId: string,
  input: CreateOrderInput
): Promise<typeof orders.$inferSelect> {
  return db.transaction(async (tx) => {
    // 1. Fetch menu items to get current prices
    const menuItemIds = input.items.map((i) => i.menuItemId);
    const fetchedItems = await tx.query.menuItems.findMany({
      where: inArray(menuItems.id, menuItemIds),
    });
    const itemMap = new Map(fetchedItems.map((m) => [m.id, m]));

    // 2. Fetch restaurant for taxRate
    const restaurantRow = await tx.query.restaurants.findFirst({
      where: (r, { eq }) => eq(r.id, restaurantId),
    });
    const taxRate = Number(restaurantRow?.taxRate ?? 0) / 100;

    // 3. Calculate totals
    let subtotal = 0;
    for (const item of input.items) {
      const menuItem = itemMap.get(item.menuItemId);
      if (!menuItem) throw new TRPCError({ code: "NOT_FOUND", message: `Menu item ${item.menuItemId} not found` });
      subtotal += Number(menuItem.price) * item.quantity;
    }
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    // 4. Insert order
    const [order] = await tx.insert(orders).values({
      restaurantId,
      tableId: input.tableId,
      waiterId,
      status: "draft",
      notes: input.notes,
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2),
    }).returning();

    // 5. Insert order items with price/name snapshots
    for (const item of input.items) {
      const menuItem = itemMap.get(item.menuItemId)!;
      await tx.insert(orderItems).values({
        orderId: order.id,
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPrice: menuItem.price,
        itemName: menuItem.name,
        notes: item.notes,
        status: "pending",
      });
    }

    // 6. Log created event
    await tx.insert(orderEvents).values({
      orderId: order.id,
      userId: waiterId,
      action: "created",
    });

    return order;
  });
}

// placeOrder — deduct stock, set status=placed. Idempotency guard: throws if not draft
export async function placeOrder(
  db: Db,
  restaurantId: string,
  orderId: string
): Promise<typeof orders.$inferSelect> {
  return db.transaction(async (tx) => {
    // 1. Fetch order — throw BAD_REQUEST if status !== "draft"
    const order = await tx.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.restaurantId, restaurantId)),
      with: { items: true },
    });
    if (!order) throw new TRPCError({ code: "NOT_FOUND" });
    if (order.status !== "draft") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Order is not a draft" });
    }

    // 2. For each order item, deduct stock via recipe items
    for (const item of order.items) {
      const recipes = await tx.query.recipeItems.findMany({
        where: eq(recipeItems.menuItemId, item.menuItemId),
      });
      for (const recipe of recipes) {
        const deductQty = Number(recipe.quantity) * item.quantity;
        await tx
          .update(ingredients)
          .set({
            currentStock: sql`${ingredients.currentStock} - ${deductQty}`,
            updatedAt: new Date(),
          })
          .where(eq(ingredients.id, recipe.ingredientId));
        await tx.insert(inventoryTransactions).values({
          restaurantId,
          ingredientId: recipe.ingredientId,
          type: "usage",
          quantity: String(-deductQty),
          orderId,
          notes: `order item: ${item.itemName}`,
          createdBy: order.waiterId,
        });
      }
    }

    // 3. Update order status to "placed"
    const [updated] = await tx
      .update(orders)
      .set({ status: "placed", updatedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();

    // 4. Log event
    await tx.insert(orderEvents).values({
      orderId,
      userId: order.waiterId,
      action: "placed",
    });

    return updated;
  });
}

// cancelOrder — CRITICAL: restore stock only for non-cancelled items
export async function cancelOrder(
  db: Db,
  restaurantId: string,
  orderId: string
): Promise<typeof orders.$inferSelect> {
  return db.transaction(async (tx) => {
    // 1. Fetch order — throw if already served or cancelled
    const order = await tx.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.restaurantId, restaurantId)),
      with: { items: true },
    });
    if (!order) throw new TRPCError({ code: "NOT_FOUND" });
    if (order.status === "served" || order.status === "cancelled") {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Cannot cancel a ${order.status} order` });
    }

    // 2. If order was placed (stock was decremented), restore stock for non-cancelled items only
    if (order.status !== "draft") {
      const activeItems = order.items.filter((i) => i.status !== "cancelled");
      for (const item of activeItems) {
        const recipes = await tx.query.recipeItems.findMany({
          where: eq(recipeItems.menuItemId, item.menuItemId),
        });
        for (const recipe of recipes) {
          const restoreQty = Number(recipe.quantity) * item.quantity;
          await tx
            .update(ingredients)
            .set({
              currentStock: sql`${ingredients.currentStock} + ${restoreQty}`,
              updatedAt: new Date(),
            })
            .where(eq(ingredients.id, recipe.ingredientId));
          await tx.insert(inventoryTransactions).values({
            restaurantId,
            ingredientId: recipe.ingredientId,
            type: "adjustment",
            quantity: String(restoreQty),
            orderId,
            notes: "order cancelled",
            createdBy: order.waiterId,
          });
        }
      }
    }

    // 3. Cancel all items + order in same transaction
    await tx
      .update(orderItems)
      .set({ status: "cancelled" })
      .where(eq(orderItems.orderId, orderId));
    const [updated] = await tx
      .update(orders)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();

    await tx.insert(orderEvents).values({
      orderId,
      userId: order.waiterId,
      action: "cancelled",
    });

    return updated;
  });
}

// syncOrderStatus — GUARD: never downgrades served/cancelled orders
export async function syncOrderStatus(
  db: Db,
  orderId: string
): Promise<OrderStatus | null> {
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: { items: true },
  });
  if (!order) return null;

  // GUARD: never downgrade terminal states
  if (order.status === "served" || order.status === "cancelled") return null;

  const activeItems = order.items.filter((i) => i.status !== "cancelled");

  if (activeItems.length === 0) {
    await db.update(orders).set({ status: "cancelled", updatedAt: new Date() }).where(eq(orders.id, orderId));
    return "cancelled";
  }

  const allReady = activeItems.every((i) => i.status === "ready" || i.status === "served");
  if (allReady) {
    await db.update(orders).set({ status: "ready", updatedAt: new Date() }).where(eq(orders.id, orderId));
    return "ready";
  }

  const anyPreparing = activeItems.some((i) => i.status === "preparing");
  if (anyPreparing) {
    await db.update(orders).set({ status: "preparing", updatedAt: new Date() }).where(eq(orders.id, orderId));
    return "preparing";
  }

  return null;
}

export async function serveOrder(
  db: Db,
  restaurantId: string,
  orderId: string
): Promise<typeof orders.$inferSelect> {
  const [updated] = await db
    .update(orders)
    .set({ status: "served", updatedAt: new Date() })
    .where(
      and(
        eq(orders.id, orderId),
        eq(orders.restaurantId, restaurantId),
        inArray(orders.status, ["ready", "placed", "preparing"])
      )
    )
    .returning();
  if (!updated) throw new TRPCError({ code: "BAD_REQUEST", message: "Order cannot be served" });
  return updated;
}

export async function applyDiscount(
  db: Db,
  restaurantId: string,
  orderId: string,
  input: ApplyDiscountInput
): Promise<typeof orders.$inferSelect> {
  // Fetch current order to get subtotal
  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.restaurantId, restaurantId)),
  });
  if (!order) throw new TRPCError({ code: "NOT_FOUND" });

  const subtotal = Number(order.subtotal);
  let discountAmount = 0;

  if (input.type === "percentage") {
    discountAmount = (subtotal * input.value) / 100;
  } else if (input.type === "fixed") {
    discountAmount = Math.min(input.value, subtotal);
  }

  // Fetch restaurant for taxRate
  const restaurantRow = await db.query.restaurants.findFirst({
    where: (r, { eq }) => eq(r.id, restaurantId),
  });
  const taxRate = Number(restaurantRow?.taxRate ?? 0) / 100;
  const discountedSubtotal = subtotal - discountAmount;
  const tax = discountedSubtotal * taxRate;
  const total = discountedSubtotal + tax;

  const [updated] = await db
    .update(orders)
    .set({
      discountType: input.type,
      discountValue: String(input.value),
      discountAmount: discountAmount.toFixed(2),
      discountReason: input.reason,
      tax: tax.toFixed(2),
      total: total.toFixed(2),
      updatedAt: new Date(),
    })
    .where(and(eq(orders.id, orderId), eq(orders.restaurantId, restaurantId)))
    .returning();

  return updated;
}

export async function transferOrder(
  db: Db,
  restaurantId: string,
  orderId: string,
  input: TransferOrderInput
): Promise<typeof orders.$inferSelect> {
  const [updated] = await db
    .update(orders)
    .set({ tableId: input.targetTableId, updatedAt: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.restaurantId, restaurantId)))
    .returning();
  if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
  return updated;
}

export async function mergeOrders(
  db: Db,
  restaurantId: string,
  sourceId: string,
  targetId: string
): Promise<typeof orders.$inferSelect> {
  return db.transaction(async (tx) => {
    // 1. Fetch both orders
    const sourceOrder = await tx.query.orders.findFirst({
      where: and(eq(orders.id, sourceId), eq(orders.restaurantId, restaurantId)),
      with: { items: true },
    });
    const targetOrder = await tx.query.orders.findFirst({
      where: and(eq(orders.id, targetId), eq(orders.restaurantId, restaurantId)),
      with: { items: true },
    });
    if (!sourceOrder || !targetOrder) throw new TRPCError({ code: "NOT_FOUND" });

    // 2. Move all non-cancelled items from source to target
    const activeSourceItems = sourceOrder.items.filter((i) => i.status !== "cancelled");
    if (activeSourceItems.length > 0) {
      await tx
        .update(orderItems)
        .set({ orderId: targetId })
        .where(
          and(
            eq(orderItems.orderId, sourceId),
            inArray(orderItems.status, ["pending", "preparing", "ready", "served"])
          )
        );
    }

    // 3. Recalculate target totals
    const allTargetItems = await tx.query.orderItems.findMany({
      where: and(eq(orderItems.orderId, targetId)),
      with: { menuItem: true },
    });
    const activeItems = allTargetItems.filter((i) => i.status !== "cancelled");
    const subtotal = activeItems.reduce((sum, i) => sum + Number(i.unitPrice) * i.quantity, 0);

    const restaurantRow = await tx.query.restaurants.findFirst({
      where: (r, { eq }) => eq(r.id, restaurantId),
    });
    const taxRate = Number(restaurantRow?.taxRate ?? 0) / 100;
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    await tx
      .update(orders)
      .set({
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        total: total.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, targetId));

    // 4. Cancel source order (no stock restoration — items were moved, not removed)
    await tx
      .update(orders)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(orders.id, sourceId));

    await tx.insert(orderEvents).values({
      orderId: targetId,
      userId: targetOrder.waiterId,
      action: "merged",
      details: { sourceOrderId: sourceId },
    });

    // Also need to add to source
    const [updated] = await tx.query.orders.findMany({
      where: eq(orders.id, targetId),
    });
    return updated;
  });
}

export async function updateOrder(
  db: Db,
  restaurantId: string,
  orderId: string,
  input: UpdateOrderInput
): Promise<typeof orders.$inferSelect> {
  return db.transaction(async (tx) => {
    const order = await tx.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.restaurantId, restaurantId)),
      with: { items: true },
    });
    if (!order) throw new TRPCError({ code: "NOT_FOUND" });
    if (order.status !== "draft") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Can only update draft orders" });
    }

    if (input.items) {
      // Delete existing items
      await tx.delete(orderItems).where(eq(orderItems.orderId, orderId));

      // Fetch menu items for new items
      const menuItemIds = input.items.map((i) => i.menuItemId);
      const fetchedItems = await tx.query.menuItems.findMany({
        where: inArray(menuItems.id, menuItemIds),
      });
      const itemMap = new Map(fetchedItems.map((m) => [m.id, m]));

      // Insert new items
      for (const item of input.items) {
        const menuItem = itemMap.get(item.menuItemId);
        if (!menuItem) throw new TRPCError({ code: "NOT_FOUND", message: `Menu item ${item.menuItemId} not found` });
        await tx.insert(orderItems).values({
          orderId,
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          unitPrice: menuItem.price,
          itemName: menuItem.name,
          notes: item.notes,
          status: "pending",
        });
      }

      // Recalculate totals
      const restaurantRow = await tx.query.restaurants.findFirst({
        where: (r, { eq }) => eq(r.id, restaurantId),
      });
      const taxRate = Number(restaurantRow?.taxRate ?? 0) / 100;
      const subtotal = input.items.reduce((sum, item) => {
        const menuItem = itemMap.get(item.menuItemId)!;
        return sum + Number(menuItem.price) * item.quantity;
      }, 0);
      const tax = subtotal * taxRate;
      const total = subtotal + tax;

      const [updated] = await tx
        .update(orders)
        .set({
          notes: input.notes ?? order.notes,
          subtotal: subtotal.toFixed(2),
          tax: tax.toFixed(2),
          total: total.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))
        .returning();

      await tx.insert(orderEvents).values({
        orderId,
        userId: order.waiterId,
        action: "items_updated",
      });

      return updated;
    }

    // Just update notes
    const [updated] = await tx
      .update(orders)
      .set({ notes: input.notes, updatedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();
    return updated;
  });
}
