# Restaurant App Rewrite — Part 2: Real-time, PWA & Frontend Shell + Waiter Flow

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tRPC WebSocket subscriptions, Redis rate limiting, orders router with inventory deduction, then build the React frontend shell (TanStack Router + TanStack Query + Better Auth client + shadcn/ui), demo mode, and the complete waiter flow (tables page + order page).

**Architecture:** TypedEventEmitter per-restaurant channels on the server; tRPC subscription procedures stream events to the browser over WebSocket. On the frontend, subscriptions are mounted once in the `_app` layout and feed a Zustand notification store. All shadcn/ui components are installed individually — no external component library bundled wholesale.

**Tech Stack:** tRPC v11 WebSocket adapter, eventemitter3, web-push, React 19, TanStack Router v1, TanStack Query v5, Better Auth client, shadcn/ui, Zustand, vite-plugin-pwa (Workbox)

---

## File Map

**Server additions:**
- Create: `apps/server/src/lib/emitter.ts` — typed per-restaurant event emitter
- Create: `apps/server/src/lib/rateLimiter.ts` — Redis sliding window
- Create: `apps/server/src/routers/orders.ts` — full order lifecycle + inventory deduction
- Create: `apps/server/src/routers/notifications.ts` — tRPC subscription router
- Modify: `apps/server/src/routers/index.ts` — add orders + notifications
- Modify: `apps/server/src/index.ts` — add WebSocket server

**Frontend:**
- Create: `apps/web/package.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/trpc.ts` — tRPC client
- Create: `apps/web/src/auth.ts` — Better Auth client
- Create: `apps/web/src/store/notificationStore.ts` — Zustand slice
- Create: `apps/web/src/routes/__root.tsx`
- Create: `apps/web/src/routes/_app.tsx` — shell layout
- Create: `apps/web/src/routes/index.tsx` — root redirect
- Create: `apps/web/src/routes/login.tsx`
- Create: `apps/web/src/routes/demo.tsx` — role picker
- Create: `apps/web/src/components/DemoBanner.tsx`
- Create: `apps/web/src/components/NotificationCenter.tsx`
- Create: `apps/web/src/components/AppShell.tsx`
- Create: `apps/web/src/hooks/useSubscriptions.ts`
- Create: `apps/web/src/routes/_app/waiter/tables.tsx`
- Create: `apps/web/src/routes/_app/waiter/orders.$id.tsx`
- Create: `apps/web/src/sw.ts`

---

### Task 1: Typed Event Emitter (Server)

**Files:**
- Create: `apps/server/src/lib/emitter.ts`

- [ ] **Step 1: Create `apps/server/src/lib/emitter.ts`**

```typescript
import EventEmitter from "eventemitter3";

// Per-restaurant event channels — only restaurant members receive events
// from their own restaurant

export type OrderChangeEvent = {
  event: "placed" | "updated" | "cancelled" | "served" | "ready";
  order: {
    id: string;
    status: string;
    tableId: string | null;
    waiterId: string;
    total: string;
    items: Array<{ id: string; status: string; itemName: string; quantity: number }>;
  };
};

export type KitchenChangeEvent = {
  event: "order_placed" | "item_status_changed" | "order_cancelled";
  order: {
    id: string;
    status: string;
    tableId: string | null;
    items: Array<{ id: string; status: string; itemName: string; quantity: number; notes: string | null }>;
  };
};

export type InventoryLowStockEvent = {
  ingredient: { id: string; name: string; unit: string; currentStock: string; minStock: string };
};

export type MenuChangeEvent = {
  event: "item_updated" | "item_deleted";
  menuItem: { id: string; name: string; isAvailable: boolean };
};

type Events = {
  [key: `orders:${string}`]: [OrderChangeEvent];
  [key: `kitchen:${string}`]: [KitchenChangeEvent];
  [key: `inventory:${string}`]: [InventoryLowStockEvent];
  [key: `menu:${string}`]: [MenuChangeEvent];
};

class RestaurantEmitter extends EventEmitter<Events> {
  emitOrderChange(restaurantId: string, data: OrderChangeEvent) {
    this.emit(`orders:${restaurantId}`, data);
  }
  emitKitchenChange(restaurantId: string, data: KitchenChangeEvent) {
    this.emit(`kitchen:${restaurantId}`, data);
  }
  emitInventoryLowStock(restaurantId: string, data: InventoryLowStockEvent) {
    this.emit(`inventory:${restaurantId}`, data);
  }
  emitMenuChange(restaurantId: string, data: MenuChangeEvent) {
    this.emit(`menu:${restaurantId}`, data);
  }
}

export const emitter = new RestaurantEmitter();
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/lib/emitter.ts
git commit -m "feat: typed per-restaurant event emitter for real-time subscriptions

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Redis Rate Limiter

**Files:**
- Create: `apps/server/src/lib/rateLimiter.ts`

- [ ] **Step 1: Create `apps/server/src/lib/rateLimiter.ts`**

```typescript
import { redis } from "../redis.js";
import { TRPCError } from "@trpc/server";

interface RateLimitOptions {
  windowMs: number;  // milliseconds
  max: number;       // max requests per window
}

export async function checkRateLimit(
  key: string,
  options: RateLimitOptions
): Promise<void> {
  const now = Date.now();
  const windowStart = now - options.windowMs;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(key, "-inf", windowStart);
  pipeline.zadd(key, now, `${now}-${Math.random()}`);
  pipeline.zcard(key);
  pipeline.pexpire(key, options.windowMs);
  const results = await pipeline.exec();

  const count = results![2][1] as number;
  if (count > options.max) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Rate limit exceeded. Please try again later.",
    });
  }
}

// Pre-defined limit configs
export const LIMITS = {
  global: { windowMs: 60_000, max: 100 },
  login: { windowMs: 15 * 60_000, max: 10 },
  register: { windowMs: 60 * 60_000, max: 5 },
} as const;
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/lib/rateLimiter.ts
git commit -m "feat: Redis-backed sliding window rate limiter (replaces in-memory limiter)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Orders Router with Inventory Deduction

**Files:**
- Create: `apps/server/src/routers/orders.ts`

This is the most critical router — all inventory stock accounting bugs from the old app are fixed here.

- [ ] **Step 1: Create `apps/server/src/routers/orders.ts`**

```typescript
import { z } from "zod";
import { eq, and, inArray, sql } from "drizzle-orm";
import { router, restaurantProcedure, waiterProcedure, cashierProcedure, adminProcedure, kitchenProcedure } from "../trpc/trpc.js";
import { orders, orderItems, orderEvents, menuItems, recipeItems, ingredients, inventoryTransactions, tables } from "@restaurant/db";
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
      const [ing] = await db.select().from(ingredients).where(eq(ingredients.id, recipe.ingredientId));
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

/** Restore ingredients for cancelled items (called on item cancel or order cancel)
 *  BUG FIX: only restores items that were NOT already individually cancelled
 */
async function restoreIngredients(
  db: any,
  restaurantId: string,
  orderId: string,
  userId: string,
  itemIds: string[]  // specific order_item IDs to restore
) {
  // Find the usage transactions for these items
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
    .where(and(eq(orderItems.orderId, orderId), sql`${orderItems.status} != 'cancelled'`));

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
      if (ctx.session!.user.role === "waiter") {
        conditions.push(eq(orders.waiterId, ctx.session!.user.id));
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
        .where(and(eq(orders.id, input.id), eq(orders.restaurantId, ctx.restaurantId)));
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });

      const items = await ctx.db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, input.id))
        .orderBy(orderItems.createdAt);

      return { ...order, items };
    }),

  create: waiterProcedure
    .input(z.object({
      tableId: z.string().uuid().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [order] = await ctx.db.insert(orders).values({
        restaurantId: ctx.restaurantId,
        tableId: input.tableId ?? null,
        waiterId: ctx.session!.user.id,
        notes: input.notes,
        status: "draft",
      }).returning();

      await ctx.db.insert(orderEvents).values({
        orderId: order.id,
        userId: ctx.session!.user.id,
        action: "created",
      });

      return order;
    }),

  update: waiterProcedure
    .input(z.object({
      id: z.string().uuid(),
      items: z.array(z.object({
        menuItemId: z.string().uuid(),
        quantity: z.number().int().min(1),
        notes: z.string().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const [order] = await ctx.db
        .select()
        .from(orders)
        .where(and(eq(orders.id, input.id), eq(orders.restaurantId, ctx.restaurantId)));

      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      if (order.status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Can only edit draft orders" });
      }

      // Delete existing items and replace
      await ctx.db.delete(orderItems).where(eq(orderItems.orderId, input.id));

      if (input.items.length > 0) {
        // Snapshot item names + prices at time of order (prevents price drift)
        const menuItemIds = input.items.map(i => i.menuItemId);
        const menuItemRows = await ctx.db
          .select()
          .from(menuItems)
          .where(inArray(menuItems.id, menuItemIds));

        const menuMap = new Map(menuItemRows.map(m => [m.id, m]));

        await ctx.db.insert(orderItems).values(
          input.items.map(item => {
            const mi = menuMap.get(item.menuItemId);
            if (!mi) throw new TRPCError({ code: "NOT_FOUND", message: `Menu item ${item.menuItemId} not found` });
            return {
              orderId: input.id,
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              unitPrice: mi.price,
              itemName: mi.name,
              notes: item.notes ?? null,
            };
          })
        );
      }

      // Recalc totals — need restaurant tax rate
      const [restaurant] = await ctx.db
        .select({ taxRate: (await import("@restaurant/db")).restaurants.taxRate })
        .from((await import("@restaurant/db")).restaurants)
        .where(eq((await import("@restaurant/db")).restaurants.id, ctx.restaurantId));

      await recalcOrder(ctx.db, input.id, Number(restaurant?.taxRate ?? 0));

      await ctx.db.insert(orderEvents).values({
        orderId: input.id,
        userId: ctx.session!.user.id,
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
        .where(and(eq(orders.id, input.id), eq(orders.restaurantId, ctx.restaurantId)));

      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      if (order.status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Order already placed" });
      }

      const items = await ctx.db
        .select()
        .from(orderItems)
        .where(and(eq(orderItems.orderId, input.id), sql`${orderItems.status} != 'cancelled'`));

      if (items.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot place empty order" });
      }

      // Deduct ingredients (transactional: if this fails, order stays draft)
      await deductIngredients(
        ctx.db,
        ctx.restaurantId,
        input.id,
        ctx.session!.user.id,
        items.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity }))
      );

      const [updated] = await ctx.db
        .update(orders)
        .set({ status: "placed", updatedAt: new Date() })
        .where(eq(orders.id, input.id))
        .returning();

      await ctx.db.insert(orderEvents).values({
        orderId: input.id,
        userId: ctx.session!.user.id,
        action: "placed",
      });

      // Notify kitchen and all restaurant staff
      const fullOrder = { ...updated, items };
      emitter.emitOrderChange(ctx.restaurantId, { event: "placed", order: fullOrder as any });
      emitter.emitKitchenChange(ctx.restaurantId, { event: "order_placed", order: fullOrder as any });

      return updated;
    }),

  serve: cashierProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [order] = await ctx.db
        .select()
        .from(orders)
        .where(and(eq(orders.id, input.id), eq(orders.restaurantId, ctx.restaurantId)));

      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
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
        userId: ctx.session!.user.id,
        action: "served",
      });

      const items = await ctx.db.select().from(orderItems).where(eq(orderItems.orderId, input.id));
      emitter.emitOrderChange(ctx.restaurantId, { event: "served", order: { ...updated, items } as any });

      return updated;
    }),

  cancel: restaurantProcedure
    .input(z.object({
      id: z.string().uuid(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [order] = await ctx.db
        .select()
        .from(orders)
        .where(and(eq(orders.id, input.id), eq(orders.restaurantId, ctx.restaurantId)));

      if (!order) throw new TRPCError({ code: "NOT_FOUND" });

      const role = ctx.session!.user.role;
      // Waiters can only cancel their own orders
      if (role === "waiter" && order.waiterId !== ctx.session!.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      // Kitchen cannot cancel
      if (role === "kitchen") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const terminalStates = ["served", "cancelled"];
      if (terminalStates.includes(order.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Order already in terminal state" });
      }

      // BUG FIX: Only restore stock for items NOT already individually cancelled
      // by the kitchen. Do NOT double-restore.
      if (order.status !== "draft") {
        const activeItems = await ctx.db
          .select()
          .from(orderItems)
          .where(and(
            eq(orderItems.orderId, input.id),
            sql`${orderItems.status} != 'cancelled'`
          ));

        if (activeItems.length > 0) {
          await restoreIngredients(
            ctx.db, ctx.restaurantId, input.id, ctx.session!.user.id,
            activeItems.map(i => i.id)
          );
        }
      }

      // Cancel all non-cancelled items
      await ctx.db
        .update(orderItems)
        .set({ status: "cancelled" })
        .where(and(
          eq(orderItems.orderId, input.id),
          sql`${orderItems.status} != 'cancelled'`
        ));

      const [updated] = await ctx.db
        .update(orders)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(orders.id, input.id))
        .returning();

      await ctx.db.insert(orderEvents).values({
        orderId: input.id,
        userId: ctx.session!.user.id,
        action: "cancelled",
        details: { reason: input.reason ?? null },
      });

      const items = await ctx.db.select().from(orderItems).where(eq(orderItems.orderId, input.id));
      emitter.emitOrderChange(ctx.restaurantId, { event: "cancelled", order: { ...updated, items } as any });
      emitter.emitKitchenChange(ctx.restaurantId, { event: "order_cancelled", order: { ...updated, items } as any });

      return updated;
    }),

  applyDiscount: cashierProcedure
    .input(z.object({
      id: z.string().uuid(),
      type: z.enum(["none", "percentage", "fixed"]),
      value: z.number().min(0),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [order] = await ctx.db
        .select()
        .from(orders)
        .where(and(eq(orders.id, input.id), eq(orders.restaurantId, ctx.restaurantId)));

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
          total: String((subtotal + Number(order.tax) - discountAmount).toFixed(2)),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, input.id))
        .returning();

      await ctx.db.insert(orderEvents).values({
        orderId: input.id,
        userId: ctx.session!.user.id,
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
          .where(eq(orderEvents.orderId, input.id))
          .orderBy(orderEvents.createdAt);
      }),
  }),
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/routers/orders.ts
git commit -m "feat: orders router with correct inventory deduction and stock restore bug fixes

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: tRPC Subscriptions Router

**Files:**
- Create: `apps/server/src/routers/notifications.ts`

- [ ] **Step 1: Create `apps/server/src/routers/notifications.ts`**

```typescript
import { observable } from "@trpc/server/observable";
import { router, restaurantProcedure, kitchenProcedure, adminProcedure } from "../trpc/trpc.js";
import { emitter, type OrderChangeEvent, type KitchenChangeEvent, type InventoryLowStockEvent, type MenuChangeEvent } from "../lib/emitter.js";

export const notificationsRouter = router({
  orders: router({
    onChange: restaurantProcedure.subscription(({ ctx }) => {
      return observable<OrderChangeEvent>((emit) => {
        const handler = (data: OrderChangeEvent) => emit.next(data);
        emitter.on(`orders:${ctx.restaurantId}`, handler);
        return () => emitter.off(`orders:${ctx.restaurantId}`, handler);
      });
    }),
  }),

  kitchen: router({
    onChange: kitchenProcedure.subscription(({ ctx }) => {
      return observable<KitchenChangeEvent>((emit) => {
        const handler = (data: KitchenChangeEvent) => emit.next(data);
        emitter.on(`kitchen:${ctx.restaurantId}`, handler);
        return () => emitter.off(`kitchen:${ctx.restaurantId}`, handler);
      });
    }),
  }),

  inventory: router({
    onLowStock: adminProcedure.subscription(({ ctx }) => {
      return observable<InventoryLowStockEvent>((emit) => {
        const handler = (data: InventoryLowStockEvent) => emit.next(data);
        emitter.on(`inventory:${ctx.restaurantId}`, handler);
        return () => emitter.off(`inventory:${ctx.restaurantId}`, handler);
      });
    }),
  }),

  menu: router({
    onChange: restaurantProcedure.subscription(({ ctx }) => {
      return observable<MenuChangeEvent>((emit) => {
        const handler = (data: MenuChangeEvent) => emit.next(data);
        emitter.on(`menu:${ctx.restaurantId}`, handler);
        return () => emitter.off(`menu:${ctx.restaurantId}`, handler);
      });
    }),
  }),
});
```

- [ ] **Step 2: Update `apps/server/src/routers/index.ts`**

```typescript
import { router } from "../trpc/trpc.js";
import { menuRouter } from "./menu.js";
import { tablesRouter } from "./tables.js";
import { staffRouter } from "./staff.js";
import { ordersRouter } from "./orders.js";
import { notificationsRouter } from "./notifications.js";

export const appRouter = router({
  menu: menuRouter,
  tables: tablesRouter,
  staff: staffRouter,
  orders: ordersRouter,
  notifications: notificationsRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 3: Update `apps/server/src/index.ts`** — add WebSocket server for subscriptions

Replace the tRPC plugin registration block with:

```typescript
import { WebSocketServer } from "ws";
import { applyWSSHandler } from "@trpc/server/adapters/ws";

// After app.register(cookie) call, add:
const wss = new WebSocketServer({ noServer: true });

applyWSSHandler({
  wss,
  router: appRouter,
  createContext,
});

// Upgrade HTTP connections to WebSocket for /api/trpc
app.server?.on("upgrade", (req, socket, head) => {
  if (req.url?.startsWith("/api/trpc")) {
    wss.handleUpgrade(req, socket as any, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  }
});
```

Also add `ws` to server `package.json` dependencies:
```json
"ws": "^8.18.0",
"@types/ws": "^8.5.0"
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/routers/notifications.ts apps/server/src/routers/index.ts apps/server/src/index.ts apps/server/package.json
git commit -m "feat: tRPC subscription router + WebSocket server for real-time events

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Frontend — Package Setup + Vite + Tailwind

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/tsconfig.json`

- [ ] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "@restaurant/web",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@restaurant/db": "workspace:*",
    "@trpc/client": "^11.0.0",
    "@trpc/react-query": "^11.0.0",
    "@tanstack/react-router": "^1.48.0",
    "@tanstack/react-query": "^5.37.0",
    "better-auth": "^1.2.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zustand": "^5.0.0",
    "lucide-react": "^0.400.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.3.0"
  },
  "devDependencies": {
    "@tanstack/router-devtools": "^1.48.0",
    "@tanstack/router-vite-plugin": "^1.48.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.4.0",
    "vite": "^5.3.0",
    "vite-plugin-pwa": "^0.21.0"
  }
}
```

- [ ] **Step 2: Create `apps/web/tailwind.config.ts`**

```typescript
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#08090e",
        surface: "#111318",
        border: "#1f2128",
        muted: "#6b7280",
        accent: "#f59e0b",
        "accent-hover": "#d97706",
        destructive: "#ef4444",
        success: "#22c55e",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 3: Create `apps/web/vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-vite-plugin";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [
    react(),
    TanStackRouterVite(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "prompt",
      manifest: {
        name: "Tu Restaurante",
        short_name: "Restaurante",
        display: "standalone",
        orientation: "portrait-primary",
        theme_color: "#08090e",
        background_color: "#08090e",
        start_url: "/",
        lang: "es",
        icons: [
          { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
          { src: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png", purpose: "apple touch icon" },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL ?? "http://localhost:3000",
        ws: true,
      },
    },
  },
});
```

- [ ] **Step 4: Create `apps/web/index.html`**

```html
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#08090e" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <title>Tu Restaurante</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `apps/web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false
  },
  "include": ["src"]
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/
git commit -m "feat: React frontend scaffold with Vite, Tailwind, TanStack Router, PWA config

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: tRPC Client + Better Auth Client + Zustand Store

**Files:**
- Create: `apps/web/src/trpc.ts`
- Create: `apps/web/src/auth.ts`
- Create: `apps/web/src/store/notificationStore.ts`

- [ ] **Step 1: Create `apps/web/src/trpc.ts`**

```typescript
import { createTRPCClient, httpBatchLink, splitLink, wsLink, createWSClient } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../server/src/routers/index.js";

export const trpc = createTRPCReact<AppRouter>();

const apiBase = import.meta.env.VITE_API_URL ?? "";

const wsClient = createWSClient({
  url: `${apiBase.replace("http", "ws")}/api/trpc`,
});

export const trpcClient = trpc.createClient({
  links: [
    splitLink({
      condition: (op) => op.type === "subscription",
      true: wsLink({ client: wsClient }),
      false: httpBatchLink({
        url: `${apiBase}/api/trpc`,
        fetch(url, options) {
          return fetch(url, { ...options, credentials: "include" });
        },
      }),
    }),
  ],
});
```

- [ ] **Step 2: Create `apps/web/src/auth.ts`**

```typescript
import { createAuthClient } from "better-auth/react";
import { anonymousClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL ?? "",
  plugins: [anonymousClient()],
});

export type Session = typeof authClient.$Infer.Session;
```

- [ ] **Step 3: Create `apps/web/src/store/notificationStore.ts`**

```typescript
import { create } from "zustand";

export type Notification = {
  id: string;
  type: "order_ready" | "order_placed" | "order_cancelled" | "low_stock" | "menu_change";
  title: string;
  message: string;
  url?: string;
  readAt?: Date;
  createdAt: Date;
};

type NotificationStore = {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (n: Omit<Notification, "id" | "createdAt">) => void;
  markAllRead: () => void;
  clear: () => void;
};

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (n) =>
    set((state) => {
      const notification: Notification = {
        ...n,
        id: crypto.randomUUID(),
        createdAt: new Date(),
      };
      const next = [notification, ...state.notifications].slice(0, 10); // keep last 10
      return {
        notifications: next,
        unreadCount: state.unreadCount + 1,
      };
    }),

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, readAt: new Date() })),
      unreadCount: 0,
    })),

  clear: () => set({ notifications: [], unreadCount: 0 }),
}));
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/
git commit -m "feat: tRPC client, Better Auth client, Zustand notification store

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: React Entry + TanStack Router Root

**Files:**
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/routes/__root.tsx`
- Create: `apps/web/src/routes/index.tsx`

- [ ] **Step 1: Create `apps/web/src/main.tsx`**

```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, trpcClient } from "./trpc.js";
import { routeTree } from "./routeTree.gen.js"; // auto-generated by TanStack Router Vite plugin
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

const router = createRouter({ routeTree });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </trpc.Provider>
  </React.StrictMode>
);
```

- [ ] **Step 2: Create `apps/web/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-white font-sans antialiased;
  }
}
```

- [ ] **Step 3: Create `apps/web/src/routes/__root.tsx`**

```typescript
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
      {import.meta.env.DEV && <TanStackRouterDevtools />}
    </>
  ),
});
```

- [ ] **Step 4: Create `apps/web/src/routes/index.tsx`** — role-based redirect

```typescript
import { createFileRoute, redirect } from "@tanstack/react-router";
import { authClient } from "../auth.js";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session?.data?.user) {
      throw redirect({ to: "/login" });
    }
    const role = (session.data.user as any).role;
    if (!role) throw redirect({ to: "/pending" });
    if (role === "superadmin") throw redirect({ to: "/platform/restaurants" });
    if (role === "waiter") throw redirect({ to: "/waiter/tables" });
    if (role === "kitchen") throw redirect({ to: "/kitchen" });
    if (role === "cashier") throw redirect({ to: "/cashier/tables" });
    if (role === "admin") throw redirect({ to: "/admin" });
    throw redirect({ to: "/login" });
  },
  component: () => null,
});
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/
git commit -m "feat: React entry, TanStack Router root, role-based root redirect

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 8: Login Page + Auth Routes

**Files:**
- Create: `apps/web/src/routes/login.tsx`
- Create: `apps/web/src/routes/pending.tsx`
- Create: `apps/web/src/routes/verify-email.tsx`

- [ ] **Step 1: Create `apps/web/src/routes/login.tsx`**

```typescript
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "../auth.js";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        const result = await authClient.signIn.email({ email, password });
        if (result.error) throw new Error(result.error.message);
      } else {
        const result = await authClient.signUp.email({ email, password, name });
        if (result.error) throw new Error(result.error.message);
      }
      navigate({ to: "/" });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    await authClient.signIn.social({ provider: "google", callbackURL: "/" });
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Tu Restaurante</h1>
          <p className="text-muted mt-1">
            {mode === "login" ? "Sign in to continue" : "Create your account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface rounded-xl p-6 space-y-4 border border-border">
          {mode === "register" && (
            <input
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
          <input
            type="email"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <p className="text-destructive text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-accent-hover text-black font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? "Loading…" : mode === "login" ? "Sign in" : "Create account"}
          </button>

          <button
            type="button"
            onClick={handleGoogle}
            className="w-full bg-surface border border-border py-2 rounded-lg text-sm hover:bg-border transition-colors flex items-center justify-center gap-2"
          >
            <span>Continue with Google</span>
          </button>
        </form>

        <p className="text-center text-sm text-muted">
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            className="text-accent hover:underline"
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>

        <p className="text-center">
          <a href="/demo" className="text-sm text-accent hover:underline">
            Try Demo Mode →
          </a>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `apps/web/src/routes/pending.tsx`**

```typescript
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/pending")({
  component: () => (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4 max-w-sm">
        <h1 className="text-xl font-semibold">Pending Approval</h1>
        <p className="text-muted text-sm">
          Your account is awaiting role assignment by an admin.
          You'll receive an email when you're approved.
        </p>
      </div>
    </div>
  ),
});
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/routes/
git commit -m "feat: login page with email/password + Google OAuth, pending approval page

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 9: App Shell + Subscriptions

**Files:**
- Create: `apps/web/src/routes/_app.tsx`
- Create: `apps/web/src/hooks/useSubscriptions.ts`
- Create: `apps/web/src/components/AppShell.tsx`

- [ ] **Step 1: Create `apps/web/src/hooks/useSubscriptions.ts`**

```typescript
import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "../trpc.js";
import { useNotificationStore } from "../store/notificationStore.js";
import { authClient } from "../auth.js";

/** Mount all 4 tRPC subscriptions once in the _app layout */
export function useSubscriptions() {
  const queryClient = useQueryClient();
  const addNotification = useNotificationStore((s) => s.addNotification);
  const { data: session } = authClient.useSession();
  const role = (session?.user as any)?.role;

  // Orders subscription — all restaurant staff
  trpc.notifications.orders.onChange.useSubscription(undefined, {
    enabled: !!session?.user,
    onData(data) {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      if (data.event === "ready") {
        addNotification({
          type: "order_ready",
          title: "Order Ready",
          message: `Order is ready to serve`,
          url: `/waiter/orders/${data.order.id}`,
        });
      }
      if (data.event === "placed") {
        addNotification({
          type: "order_placed",
          title: "New Order",
          message: `New order placed`,
        });
      }
    },
  });

  // Kitchen subscription
  trpc.notifications.kitchen.onChange.useSubscription(undefined, {
    enabled: role === "kitchen" || role === "admin",
    onData() {
      queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] });
    },
  });

  // Inventory low stock — admin only
  trpc.notifications.inventory.onLowStock.useSubscription(undefined, {
    enabled: role === "admin",
    onData(data) {
      addNotification({
        type: "low_stock",
        title: "Low Stock Alert",
        message: `${data.ingredient.name}: ${data.ingredient.currentStock} ${data.ingredient.unit} remaining`,
        url: "/admin/inventory",
      });
    },
  });

  // Menu changes — all roles
  trpc.notifications.menu.onChange.useSubscription(undefined, {
    enabled: !!session?.user,
    onData() {
      queryClient.invalidateQueries({ queryKey: ["menu"] });
    },
  });
}
```

- [ ] **Step 2: Create `apps/web/src/components/AppShell.tsx`**

```typescript
import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, ChefHat, ClipboardList, LayoutDashboard, LogOut, Menu, ShoppingBag, Users, UtensilsCrossed, Warehouse } from "lucide-react";
import { useState } from "react";
import { authClient } from "../auth.js";
import { useNotificationStore } from "../store/notificationStore.js";

type NavItem = { to: string; label: string; icon: React.ReactNode; roles: string[] };

const navItems: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: <LayoutDashboard size={18} />, roles: ["admin"] },
  { to: "/admin/menu", label: "Menu", icon: <UtensilsCrossed size={18} />, roles: ["admin"] },
  { to: "/admin/staff", label: "Staff", icon: <Users size={18} />, roles: ["admin"] },
  { to: "/admin/tables", label: "Tables", icon: <ClipboardList size={18} />, roles: ["admin"] },
  { to: "/admin/inventory", label: "Inventory", icon: <Warehouse size={18} />, roles: ["admin"] },
  { to: "/admin/reports", label: "Reports", icon: <ShoppingBag size={18} />, roles: ["admin"] },
  { to: "/waiter/tables", label: "Tables", icon: <ClipboardList size={18} />, roles: ["waiter"] },
  { to: "/waiter/orders", label: "Orders", icon: <ShoppingBag size={18} />, roles: ["waiter"] },
  { to: "/cashier/tables", label: "Tables", icon: <ClipboardList size={18} />, roles: ["cashier"] },
  { to: "/kitchen", label: "Kitchen", icon: <ChefHat size={18} />, roles: ["kitchen"] },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session } = authClient.useSession();
  const role = (session?.user as any)?.role ?? "";
  const unread = useNotificationStore((s) => s.unreadCount);
  const [mobileOpen, setMobileOpen] = useState(false);
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const roleNavItems = navItems.filter((n) => n.roles.includes(role));

  async function handleLogout() {
    await authClient.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className={`${mobileOpen ? "flex" : "hidden"} md:flex flex-col w-56 bg-surface border-r border-border shrink-0`}>
        <div className="p-4 border-b border-border">
          <span className="font-bold text-accent">Tu Restaurante</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {roleNavItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                currentPath.startsWith(item.to)
                  ? "bg-accent text-black font-medium"
                  : "text-muted hover:text-white hover:bg-border"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-border">
          <div className="text-xs text-muted mb-2 px-3">{session?.user.email}</div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-muted hover:text-white hover:bg-border transition-colors"
          >
            <LogOut size={18} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0">
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden">
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          <button className="relative p-2 text-muted hover:text-white">
            <Bell size={20} />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-destructive text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `apps/web/src/routes/_app.tsx`**

```typescript
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { authClient } from "../auth.js";
import { AppShell } from "../components/AppShell.js";
import { useSubscriptions } from "../hooks/useSubscriptions.js";

function AppLayout() {
  // Mount all subscriptions once at the app shell level
  useSubscriptions();

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session?.data?.user) throw redirect({ to: "/login" });
    const role = (session.data.user as any).role;
    if (!role) throw redirect({ to: "/pending" });
  },
  component: AppLayout,
});
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/
git commit -m "feat: AppShell with sidebar nav, header, subscriptions mounted once in _app

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 10: Demo Mode

**Files:**
- Create: `apps/server/src/routers/auth.ts` — demo.create procedure
- Create: `apps/web/src/routes/demo.tsx`
- Create: `apps/web/src/components/DemoBanner.tsx`

- [ ] **Step 1: Add demo router to server**

Create `apps/server/src/routers/auth.ts`:

```typescript
import { z } from "zod";
import { router, publicProcedure } from "../trpc/trpc.js";
import { auth } from "../auth.js";
import { db } from "../db.js";
import { restaurants, user } from "@restaurant/db";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const authRouter = router({
  demo: router({
    create: publicProcedure
      .input(z.object({
        role: z.enum(["admin", "waiter", "kitchen", "cashier"]),
      }))
      .mutation(async ({ ctx, input }) => {
        // Find the demo restaurant
        const [demoRestaurant] = await db
          .select()
          .from(restaurants)
          .where(eq(restaurants.status, "demo"));

        if (!demoRestaurant) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Demo not configured" });
        }

        // Create anonymous session via Better Auth anonymous plugin
        const response = await auth.api.signInAnonymous({
          headers: ctx.req.headers as any,
        });

        if (!response.user) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }

        // Assign demo role + restaurant
        await db
          .update(user)
          .set({
            role: input.role,
            restaurantId: demoRestaurant.id,
            isActive: true,
            emailVerified: true,
            name: `Demo ${input.role.charAt(0).toUpperCase() + input.role.slice(1)}`,
          })
          .where(eq(user.id, response.user.id));

        // Set session cookie in response
        for (const [key, value] of (response as any).headers?.entries?.() ?? []) {
          ctx.res.header(key, value);
        }

        return {
          role: input.role,
          restaurantId: demoRestaurant.id,
          redirect: input.role === "admin" ? "/admin"
            : input.role === "waiter" ? "/waiter/tables"
            : input.role === "kitchen" ? "/kitchen"
            : "/cashier/tables",
        };
      }),
  }),
});
```

Update `apps/server/src/routers/index.ts` to add `auth: authRouter`.

- [ ] **Step 2: Create `apps/web/src/routes/demo.tsx`**

```typescript
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { trpc } from "../trpc.js";

export const Route = createFileRoute("/demo")({
  component: DemoPage,
});

const roles = [
  { id: "admin", label: "Admin", description: "Manage menu, staff, inventory, reports", color: "bg-purple-600" },
  { id: "waiter", label: "Waiter", description: "Take orders, manage tables", color: "bg-blue-600" },
  { id: "kitchen", label: "Kitchen", description: "See incoming orders, update item status", color: "bg-orange-600" },
  { id: "cashier", label: "Cashier", description: "Process payments, apply discounts", color: "bg-green-600" },
] as const;

function DemoPage() {
  const navigate = useNavigate();
  const createDemo = trpc.auth.demo.create.useMutation({
    onSuccess(data) {
      navigate({ to: data.redirect });
    },
  });

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Try Demo Mode</h1>
          <p className="text-muted mt-2">Choose a role to explore the full experience</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => createDemo.mutate({ role: role.id })}
              disabled={createDemo.isPending}
              className={`${role.color} hover:opacity-90 rounded-xl p-6 text-left transition-all disabled:opacity-50`}
            >
              <div className="font-bold text-lg mb-1">{role.label}</div>
              <div className="text-sm opacity-80">{role.description}</div>
            </button>
          ))}
        </div>

        <p className="text-center text-sm text-muted">
          <a href="/login" className="hover:underline">← Back to login</a>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `apps/web/src/components/DemoBanner.tsx`**

```typescript
import { trpc } from "../trpc.js";
import { useNavigate } from "@tanstack/react-router";
import { authClient } from "../auth.js";

const roles = ["admin", "waiter", "kitchen", "cashier"] as const;
type Role = typeof roles[number];

export function DemoBanner() {
  const { data: session } = authClient.useSession();
  const navigate = useNavigate();
  const createDemo = trpc.auth.demo.create.useMutation({
    onSuccess(data) {
      navigate({ to: data.redirect });
    },
  });

  const role = (session?.user as any)?.role as Role | undefined;

  // Only show for anonymous/demo sessions
  if (!(session?.user as any)?.isAnonymous) return null;

  return (
    <div className="bg-accent text-black text-sm px-4 py-2 flex items-center justify-between flex-wrap gap-2">
      <span className="font-semibold">Demo Mode — {role}</span>
      <div className="flex gap-2">
        {roles
          .filter((r) => r !== role)
          .map((r) => (
            <button
              key={r}
              onClick={() => createDemo.mutate({ role: r })}
              className="bg-black/20 hover:bg-black/30 px-3 py-1 rounded text-xs font-medium transition-colors"
            >
              Switch to {r}
            </button>
          ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/routers/auth.ts apps/web/src/routes/demo.tsx apps/web/src/components/DemoBanner.tsx apps/server/src/routers/index.ts
git commit -m "feat: demo mode — anonymous sessions with role switcher and DemoBanner

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 11: Waiter Flow — Tables Page + Order Page

**Files:**
- Create: `apps/web/src/routes/_app/waiter/tables.tsx`
- Create: `apps/web/src/routes/_app/waiter/orders.$id.tsx`
- Create: `apps/web/src/routes/_app/waiter/orders.index.tsx`

- [ ] **Step 1: Create `apps/web/src/routes/_app/waiter/tables.tsx`**

```typescript
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { trpc } from "../../../trpc.js";

export const Route = createFileRoute("/_app/waiter/tables")({
  component: TablesPage,
});

const STATUS_COLOR: Record<string, string> = {
  free: "bg-surface border-border",
  occupied: "bg-amber-900/30 border-amber-600",
  ready: "bg-green-900/30 border-green-600",
};

function TablesPage() {
  const navigate = useNavigate();
  const { data: tables = [], isLoading } = trpc.tables.list.useQuery();
  const { data: orders = [] } = trpc.orders.list.useQuery({ status: "placed,preparing,ready" as any });

  // Map tableId → order status for coloring
  const tableOrderStatus = new Map(
    orders.map((o: any) => [o.tableId, o.status])
  );

  if (isLoading) return <div className="text-muted">Loading tables…</div>;

  async function handleTableClick(tableId: string) {
    // Check for active order on this table
    const activeOrder = orders.find((o: any) => o.tableId === tableId);
    if (activeOrder) {
      navigate({ to: "/waiter/orders/$id", params: { id: activeOrder.id } });
    } else {
      navigate({ to: "/waiter/orders/new", search: { tableId } });
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tables</h1>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {tables.map((table: any) => {
          const orderStatus = tableOrderStatus.get(table.id);
          const statusKey = orderStatus === "ready" ? "ready" : orderStatus ? "occupied" : "free";
          return (
            <button
              key={table.id}
              onClick={() => handleTableClick(table.id)}
              className={`${STATUS_COLOR[statusKey]} border rounded-xl p-4 text-left transition-all hover:scale-105`}
            >
              <div className="font-bold text-lg">{table.number}</div>
              {table.label && <div className="text-xs text-muted">{table.label}</div>}
              <div className="text-xs mt-1 capitalize">{statusKey}</div>
            </button>
          );
        })}
      </div>
      <div className="flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-surface border border-border inline-block" /> Free</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-900/30 border border-amber-600 inline-block" /> Occupied</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-900/30 border border-green-600 inline-block" /> Ready</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `apps/web/src/routes/_app/waiter/orders.$id.tsx`**

```typescript
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { trpc } from "../../../trpc.js";
import { Plus, Minus, Trash2, Send, X } from "lucide-react";

export const Route = createFileRoute("/_app/waiter/orders/$id")({
  component: OrderPage,
});

function OrderPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const isNew = id === "new";
  const search = Route.useSearch() as { tableId?: string };

  // Queries
  const { data: categories = [] } = trpc.menu.categories.list.useQuery();
  const { data: menuItemsData = [] } = trpc.menu.items.list.useQuery();
  const { data: order } = trpc.orders.get.useQuery({ id }, { enabled: !isNew });

  // Local cart state
  const [cart, setCart] = useState<Map<string, { item: any; qty: number }>>(new Map());
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const createOrder = trpc.orders.create.useMutation();
  const updateOrder = trpc.orders.update.useMutation();
  const placeOrder = trpc.orders.place.useMutation();
  const cancelOrder = trpc.orders.cancel.useMutation();

  const filteredItems = selectedCategory
    ? menuItemsData.filter((i: any) => i.categoryId === selectedCategory && i.isAvailable)
    : menuItemsData.filter((i: any) => i.isAvailable);

  const cartItems = Array.from(cart.values());
  const cartTotal = cartItems.reduce((s, { item, qty }) => s + Number(item.price) * qty, 0);

  function addToCart(item: any) {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(item.id);
      next.set(item.id, { item, qty: (existing?.qty ?? 0) + 1 });
      return next;
    });
  }

  function removeFromCart(itemId: string) {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(itemId);
      if (!existing || existing.qty <= 1) {
        next.delete(itemId);
      } else {
        next.set(itemId, { ...existing, qty: existing.qty - 1 });
      }
      return next;
    });
  }

  async function handleSendToKitchen() {
    if (cart.size === 0) return;
    setIsSending(true);
    try {
      let orderId = id;

      if (isNew) {
        const created = await createOrder.mutateAsync({ tableId: search.tableId });
        orderId = created.id;
      }

      await updateOrder.mutateAsync({
        id: orderId,
        items: cartItems.map(({ item, qty }) => ({ menuItemId: item.id, quantity: qty })),
      });

      await placeOrder.mutateAsync({ id: orderId });
      navigate({ to: "/waiter/tables" });
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsSending(false);
    }
  }

  async function handleCancel() {
    if (!id || isNew) { navigate({ to: "/waiter/tables" }); return; }
    if (!confirm("Cancel this order?")) return;
    try {
      await cancelOrder.mutateAsync({ id });
      navigate({ to: "/waiter/tables" });
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 h-full">
      {/* Menu panel */}
      <div className="flex-1 min-w-0 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{isNew ? "New Order" : `Order #${id.slice(0, 8)}`}</h1>
          {!isNew && order?.status !== "draft" && (
            <span className="text-xs bg-amber-900/30 text-amber-400 px-2 py-1 rounded capitalize">{order?.status}</span>
          )}
        </div>

        {/* Category filter */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1 rounded-full text-sm ${!selectedCategory ? "bg-accent text-black" : "bg-surface border border-border text-muted"}`}
          >
            All
          </button>
          {categories.map((c: any) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3 py-1 rounded-full text-sm ${selectedCategory === c.id ? "bg-accent text-black" : "bg-surface border border-border text-muted"}`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Menu items grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filteredItems.map((item: any) => (
            <button
              key={item.id}
              onClick={() => addToCart(item)}
              className="bg-surface border border-border rounded-xl p-3 text-left hover:border-accent transition-colors"
            >
              {item.imageUrl && (
                <img src={item.imageUrl} alt={item.name} className="w-full h-24 object-cover rounded-lg mb-2" />
              )}
              <div className="font-medium text-sm">{item.name}</div>
              <div className="text-accent text-sm">${item.price}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Cart panel */}
      <div className="w-full md:w-72 bg-surface border border-border rounded-xl flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Cart</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cartItems.length === 0 ? (
            <p className="text-muted text-sm text-center py-8">Add items from the menu</p>
          ) : (
            cartItems.map(({ item, qty }) => (
              <div key={item.id} className="flex items-center justify-between gap-2">
                <span className="text-sm flex-1 min-w-0 truncate">{item.name}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => removeFromCart(item.id)} className="p-1 text-muted hover:text-white">
                    <Minus size={14} />
                  </button>
                  <span className="text-sm w-5 text-center">{qty}</span>
                  <button onClick={() => addToCart(item)} className="p-1 text-muted hover:text-white">
                    <Plus size={14} />
                  </button>
                  <button onClick={() => cart.delete(item.id) && setCart(new Map(cart))} className="p-1 text-muted hover:text-destructive ml-1">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-border space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted">Subtotal</span>
            <span>${cartTotal.toFixed(2)}</span>
          </div>

          <button
            onClick={handleSendToKitchen}
            disabled={cart.size === 0 || isSending}
            className="w-full bg-accent hover:bg-accent-hover text-black font-semibold py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Send size={16} />
            {isSending ? "Sending…" : "Send to Kitchen"}
          </button>

          {!isNew && (
            <button
              onClick={handleCancel}
              className="w-full border border-destructive text-destructive hover:bg-destructive/10 py-2 rounded-lg text-sm flex items-center justify-center gap-2"
            >
              <X size={16} /> Cancel Order
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/routes/_app/
git commit -m "feat: waiter tables page + order page with cart, send to kitchen, cancel

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 12: PWA Service Worker

**Files:**
- Create: `apps/web/src/sw.ts`

- [ ] **Step 1: Create `apps/web/src/sw.ts`**

```typescript
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

declare const self: ServiceWorkerGlobalScope;
declare const __WB_MANIFEST: any[];

cleanupOutdatedCaches();
precacheAndRoute(__WB_MANIFEST);

// tRPC API calls — NetworkFirst (fresh data when online, cached when offline)
registerRoute(
  ({ url }) => url.pathname.startsWith("/api/trpc"),
  new NetworkFirst({
    cacheName: "trpc-cache",
    networkTimeoutSeconds: 10,
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 })],
  })
);

// Menu item images — CacheFirst with 7-day expiry
registerRoute(
  ({ url }) => url.hostname.includes("r2.dev") || url.pathname.startsWith("/images/"),
  new CacheFirst({
    cacheName: "menu-images",
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 })],
  })
);

// Google Fonts
registerRoute(
  ({ url }) => url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com",
  new StaleWhileRevalidate({ cacheName: "google-fonts" })
);

// Push notification handler
self.addEventListener("push", (event: PushEvent) => {
  const data = event.data?.json() as { title: string; body: string; url?: string } | undefined;
  if (!data) return;

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      data: { url: data.url },
    })
  );
});

// Tap notification → open URL
self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const url = event.notification.data?.url;
  if (url) {
    event.waitUntil(clients.openWindow(url));
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/sw.ts
git commit -m "feat: Workbox service worker — NetworkFirst for API, CacheFirst for images, Web Push handler

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```
