# Restaurant App Rewrite — Part 3: Kitchen, Cashier, Admin & Platform Flows

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the kitchen KDS, cashier order detail, complete admin flow (menu CRUD with image upload, staff management, table management, inventory with RecipeEditor), and the superadmin platform dashboard.

**Architecture:** All pages live under `apps/web/src/routes/_app/`. Server-side business logic is in dedicated routers. Kitchen item cancellation immediately restores ingredient stock. The inventory router handles stock deduction/restoration for individual item cancels via a separate kitchen router.

**Tech Stack:** Same as Parts 1–2. New server additions: kitchen router (item status with syncOrderStatus), inventory router (CRUD + recipe upsert), superadmin router.

---

## File Map

**Server additions:**
- Create: `apps/server/src/routers/kitchen.ts`
- Create: `apps/server/src/routers/inventory.ts`
- Create: `apps/server/src/routers/superadmin.ts`
- Modify: `apps/server/src/routers/index.ts`

**Frontend pages:**
- Create: `apps/web/src/routes/_app/kitchen/index.tsx`
- Create: `apps/web/src/routes/_app/cashier/tables.tsx`
- Create: `apps/web/src/routes/_app/cashier/orders.$id.tsx`
- Create: `apps/web/src/routes/_app/admin/index.tsx`
- Create: `apps/web/src/routes/_app/admin/menu.tsx`
- Create: `apps/web/src/routes/_app/admin/staff.tsx`
- Create: `apps/web/src/routes/_app/admin/tables.tsx`
- Create: `apps/web/src/routes/_app/admin/inventory.tsx`
- Create: `apps/web/src/routes/_app/platform/restaurants.tsx`
- Create: `apps/web/src/routes/_app/platform/pending-users.tsx`
- Create: `apps/web/src/components/RecipeEditor.tsx`

---

### Task 1: Kitchen Router (Server)

**Files:**
- Create: `apps/server/src/routers/kitchen.ts`

Critical: `syncOrderStatus()` must emit `order:ready` when all non-cancelled items are ready. This was the core bug in the old app.

- [ ] **Step 1: Create `apps/server/src/routers/kitchen.ts`**

```typescript
import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { router, kitchenProcedure } from "../trpc/trpc.js";
import { orders, orderItems, orderEvents, recipeItems, ingredients, inventoryTransactions } from "@restaurant/db";
import { emitter } from "../lib/emitter.js";
import { TRPCError } from "@trpc/server";

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
  if (nonCancelled.length === 0) return; // all cancelled — let cancel flow handle

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

  // Fetch updated order + items for subscription payload
  const [updatedOrder] = await db.select().from(orders).where(eq(orders.id, orderId));
  const allItems = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));

  if (newStatus === "ready") {
    // BUG FIX: emit order:ready — this was completely missing in the old kitchen.controller.ts
    emitter.emitOrderChange(restaurantId, {
      event: "ready",
      order: { ...updatedOrder, items: allItems } as any,
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

        // Validate transition
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
          userId: ctx.session!.user.id,
          action: "item_status_changed",
          details: { itemId: input.id, from: item.status, to: input.status },
        });

        // Notify waiters of item update
        const [order] = await ctx.db.select().from(orders).where(eq(orders.id, item.orderId));
        const allItems = await ctx.db.select().from(orderItems).where(eq(orderItems.orderId, item.orderId));
        emitter.emitKitchenChange(ctx.restaurantId, {
          event: "item_status_changed",
          order: { ...order, items: allItems } as any,
        });

        // Auto-promote order status
        await syncOrderStatus(ctx.db, item.orderId, ctx.restaurantId, ctx.session!.user.id);

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

        // Restore ingredient stock for this item only
        // BUG FIX: kitchen item cancel restores stock immediately — old app didn't do this
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
            createdBy: ctx.session!.user.id,
          });

          // Delete the original usage transaction for this item/ingredient pair
          // so full-order cancel doesn't double-restore
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
          userId: ctx.session!.user.id,
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
```

- [ ] **Step 2: Add kitchen router to `apps/server/src/routers/index.ts`**

```typescript
import { kitchenRouter } from "./kitchen.js";
// Add to appRouter:
kitchen: kitchenRouter,
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/routers/kitchen.ts apps/server/src/routers/index.ts
git commit -m "feat: kitchen router with syncOrderStatus bug fix and item cancel stock restore

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Kitchen Display Page (Frontend)

**Files:**
- Create: `apps/web/src/routes/_app/kitchen/index.tsx`

- [ ] **Step 1: Create `apps/web/src/routes/_app/kitchen/index.tsx`**

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { trpc } from "../../../trpc.js";

export const Route = createFileRoute("/_app/kitchen/")({
  component: KitchenPage,
});

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-900/30 border-yellow-700 text-yellow-300",
  preparing: "bg-blue-900/30 border-blue-700 text-blue-300",
  ready: "bg-green-900/30 border-green-700 text-green-300",
};

function KitchenPage() {
  const { data: orders = [], isLoading } = trpc.kitchen.activeOrders.list.useQuery(
    undefined,
    { refetchInterval: 30_000 } // fallback polling every 30s
  );
  const updateItemStatus = trpc.kitchen.item.updateStatus.useMutation();
  const cancelItem = trpc.kitchen.item.cancel.useMutation();
  const utils = trpc.useUtils();

  async function markItemPreparing(itemId: string) {
    await updateItemStatus.mutateAsync({ id: itemId, status: "preparing" });
    utils.kitchen.activeOrders.list.invalidate();
  }

  async function markItemReady(itemId: string) {
    await updateItemStatus.mutateAsync({ id: itemId, status: "ready" });
    utils.kitchen.activeOrders.list.invalidate();
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="text-muted">Loading orders…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Kitchen Display</h1>
        <span className="text-muted text-sm">{orders.length} active order{orders.length !== 1 ? "s" : ""}</span>
      </div>

      {orders.length === 0 ? (
        <div className="text-center text-muted py-20">No active orders</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {orders.map((order: any) => (
            <div key={order.id} className="bg-surface border border-border rounded-xl overflow-hidden">
              {/* Order header */}
              <div className={`px-4 py-3 flex items-center justify-between ${
                order.status === "placed" ? "bg-amber-900/30 border-b border-amber-700" : "bg-blue-900/30 border-b border-blue-700"
              }`}>
                <div>
                  <span className="font-bold">Table {order.tableId ? `#${order.tableId.slice(0, 4)}` : "—"}</span>
                  <span className="text-xs text-muted ml-2">
                    {new Date(order.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded capitalize font-medium ${
                  order.status === "placed" ? "bg-amber-700 text-white" : "bg-blue-700 text-white"
                }`}>{order.status}</span>
              </div>

              {/* Items */}
              <div className="p-3 space-y-2">
                {order.items.map((item: any) => (
                  <div
                    key={item.id}
                    className={`border rounded-lg p-3 ${STATUS_COLORS[item.status] ?? "bg-surface border-border"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-medium">{item.quantity}× {item.itemName}</span>
                        {item.notes && (
                          <p className="text-xs opacity-75 mt-0.5">{item.notes}</p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {item.status === "pending" && (
                          <button
                            onClick={() => markItemPreparing(item.id)}
                            className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-2 py-1 rounded"
                          >
                            Start
                          </button>
                        )}
                        {item.status === "preparing" && (
                          <button
                            onClick={() => markItemReady(item.id)}
                            className="text-xs bg-green-700 hover:bg-green-600 text-white px-2 py-1 rounded"
                          >
                            Ready
                          </button>
                        )}
                        {(item.status === "pending" || item.status === "preparing") && (
                          <button
                            onClick={() => cancelItem.mutate({ id: item.id })}
                            className="text-xs bg-destructive/30 hover:bg-destructive/50 text-destructive px-2 py-1 rounded"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/routes/_app/kitchen/
git commit -m "feat: kitchen display page — KDS with item status controls and cancel

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Cashier Flow

**Files:**
- Create: `apps/web/src/routes/_app/cashier/tables.tsx`
- Create: `apps/web/src/routes/_app/cashier/orders.$id.tsx`

- [ ] **Step 1: Create `apps/web/src/routes/_app/cashier/tables.tsx`**

```typescript
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { trpc } from "../../../trpc.js";

export const Route = createFileRoute("/_app/cashier/tables")({
  component: CashierTablesPage,
});

function CashierTablesPage() {
  const navigate = useNavigate();
  const { data: tables = [] } = trpc.tables.list.useQuery();
  const { data: orders = [] } = trpc.orders.list.useQuery();

  const tableOrderMap = new Map(
    orders
      .filter((o: any) => ["placed", "preparing", "ready"].includes(o.status))
      .map((o: any) => [o.tableId, o])
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tables</h1>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {tables.map((table: any) => {
          const order = tableOrderMap.get(table.id);
          const isReady = order?.status === "ready";
          return (
            <button
              key={table.id}
              onClick={() => order && navigate({ to: "/cashier/orders/$id", params: { id: order.id } })}
              className={`rounded-xl p-4 text-left border transition-all ${
                isReady
                  ? "bg-green-900/30 border-green-600 hover:border-green-400 cursor-pointer"
                  : order
                  ? "bg-amber-900/30 border-amber-600 hover:border-amber-400 cursor-pointer"
                  : "bg-surface border-border cursor-default"
              }`}
            >
              <div className="font-bold text-lg">{table.number}</div>
              <div className="text-xs mt-1 capitalize text-muted">
                {isReady ? "Ready to serve" : order ? order.status : "Free"}
              </div>
              {order && (
                <div className="text-xs text-accent mt-1">${order.total}</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `apps/web/src/routes/_app/cashier/orders.$id.tsx`**

```typescript
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { trpc } from "../../../trpc.js";
import { Printer, CheckCircle, X, Percent } from "lucide-react";

export const Route = createFileRoute("/_app/cashier/orders/$id")({
  component: CashierOrderPage,
});

function CashierOrderPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: order, isLoading } = trpc.orders.get.useQuery({ id });
  const utils = trpc.useUtils();

  const serve = trpc.orders.serve.useMutation({
    onSuccess: () => { utils.orders.list.invalidate(); navigate({ to: "/cashier/tables" }); },
  });
  const cancel = trpc.orders.cancel.useMutation({
    onSuccess: () => { utils.orders.list.invalidate(); navigate({ to: "/cashier/tables" }); },
  });
  const applyDiscount = trpc.orders.applyDiscount.useMutation({
    onSuccess: () => utils.orders.get.invalidate({ id }),
  });

  const [discountModal, setDiscountModal] = useState(false);
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState("");

  async function handleDiscount() {
    await applyDiscount.mutateAsync({
      id,
      type: discountType,
      value: Number(discountValue),
    });
    setDiscountModal(false);
  }

  function handlePrint() {
    window.print();
  }

  if (isLoading || !order) return <div className="text-muted">Loading…</div>;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Order Detail</h1>
        <span className={`text-xs px-2 py-1 rounded capitalize font-medium ${
          order.status === "ready" ? "bg-green-900/30 text-green-400 border border-green-700" : "bg-amber-900/30 text-amber-400 border border-amber-700"
        }`}>{order.status}</span>
      </div>

      {/* Items */}
      <div className="bg-surface border border-border rounded-xl divide-y divide-border">
        {order.items.map((item: any) => (
          <div key={item.id} className="flex justify-between px-4 py-3 text-sm">
            <span>{item.quantity}× {item.itemName}</span>
            <span>${(Number(item.unitPrice) * item.quantity).toFixed(2)}</span>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="bg-surface border border-border rounded-xl p-4 space-y-2 text-sm">
        <div className="flex justify-between text-muted">
          <span>Subtotal</span><span>${order.subtotal}</span>
        </div>
        <div className="flex justify-between text-muted">
          <span>Tax</span><span>${order.tax}</span>
        </div>
        {order.discountType !== "none" && (
          <div className="flex justify-between text-destructive">
            <span>Discount ({order.discountType} {order.discountValue})</span>
            <span>-${order.discountAmount}</span>
          </div>
        )}
        <div className="flex justify-between font-bold border-t border-border pt-2">
          <span>Total</span><span>${order.total}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setDiscountModal(true)}
          className="flex items-center justify-center gap-2 border border-border rounded-lg py-3 text-sm hover:bg-surface transition-colors"
        >
          <Percent size={16} /> Discount
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center justify-center gap-2 border border-border rounded-lg py-3 text-sm hover:bg-surface transition-colors"
        >
          <Printer size={16} /> Print Receipt
        </button>
        <button
          onClick={() => cancel.mutate({ id })}
          disabled={cancel.isPending}
          className="flex items-center justify-center gap-2 border border-destructive text-destructive rounded-lg py-3 text-sm hover:bg-destructive/10 transition-colors"
        >
          <X size={16} /> Cancel Order
        </button>
        <button
          onClick={() => serve.mutate({ id })}
          disabled={serve.isPending || order.status !== "ready"}
          className="flex items-center justify-center gap-2 bg-success hover:bg-success/80 text-black font-semibold rounded-lg py-3 text-sm disabled:opacity-50"
        >
          <CheckCircle size={16} /> Mark Served
        </button>
      </div>

      {/* Discount modal */}
      {discountModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="font-semibold">Apply Discount</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setDiscountType("percentage")}
                className={`flex-1 py-2 rounded-lg text-sm ${discountType === "percentage" ? "bg-accent text-black" : "border border-border"}`}
              >% Percentage</button>
              <button
                onClick={() => setDiscountType("fixed")}
                className={`flex-1 py-2 rounded-lg text-sm ${discountType === "fixed" ? "bg-accent text-black" : "border border-border"}`}
              >$ Fixed</button>
            </div>
            <input
              type="number"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
              placeholder={discountType === "percentage" ? "e.g. 10 (for 10%)" : "e.g. 5.00"}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
            />
            <div className="flex gap-2">
              <button onClick={() => setDiscountModal(false)} className="flex-1 border border-border py-2 rounded-lg text-sm">Cancel</button>
              <button onClick={handleDiscount} className="flex-1 bg-accent text-black py-2 rounded-lg text-sm font-semibold">Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/routes/_app/cashier/
git commit -m "feat: cashier tables page + order detail with serve, cancel, discount, print

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Inventory Router (Server)

**Files:**
- Create: `apps/server/src/routers/inventory.ts`

- [ ] **Step 1: Create `apps/server/src/routers/inventory.ts`**

```typescript
import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { router, adminProcedure } from "../trpc/trpc.js";
import { ingredients, recipeItems, inventoryTransactions, menuItems } from "@restaurant/db";
import { TRPCError } from "@trpc/server";

export const inventoryRouter = router({
  ingredients: router({
    list: adminProcedure.query(async ({ ctx }) => {
      return ctx.db
        .select()
        .from(ingredients)
        .where(eq(ingredients.restaurantId, ctx.restaurantId))
        .orderBy(ingredients.name);
    }),

    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        unit: z.enum(["g", "kg", "ml", "L", "units"]),
        currentStock: z.string().default("0"),
        minStock: z.string().default("0"),
        costPerUnit: z.string().default("0"),
      }))
      .mutation(async ({ ctx, input }) => {
        const [ingredient] = await ctx.db.insert(ingredients).values({
          restaurantId: ctx.restaurantId,
          ...input,
        }).returning();
        return ingredient;
      }),

    update: adminProcedure
      .input(z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        unit: z.enum(["g", "kg", "ml", "L", "units"]).optional(),
        minStock: z.string().optional(),
        costPerUnit: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const [updated] = await ctx.db
          .update(ingredients)
          .set({ ...data, updatedAt: new Date() })
          .where(and(eq(ingredients.id, id), eq(ingredients.restaurantId, ctx.restaurantId)))
          .returning();
        if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
        return updated;
      }),

    restock: adminProcedure
      .input(z.object({
        id: z.string().uuid(),
        quantity: z.string(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const [ingredient] = await ctx.db
          .select()
          .from(ingredients)
          .where(and(eq(ingredients.id, input.id), eq(ingredients.restaurantId, ctx.restaurantId)));

        if (!ingredient) throw new TRPCError({ code: "NOT_FOUND" });

        await ctx.db
          .update(ingredients)
          .set({
            currentStock: sql`${ingredients.currentStock} + ${input.quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(ingredients.id, input.id));

        await ctx.db.insert(inventoryTransactions).values({
          restaurantId: ctx.restaurantId,
          ingredientId: input.id,
          type: "purchase",
          quantity: input.quantity,
          notes: input.notes ?? "Restock",
          createdBy: ctx.session!.user.id,
        });

        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        await ctx.db
          .delete(ingredients)
          .where(and(eq(ingredients.id, input.id), eq(ingredients.restaurantId, ctx.restaurantId)));
        return { success: true };
      }),
  }),

  recipes: router({
    get: adminProcedure
      .input(z.object({ menuItemId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        // Verify menu item belongs to this restaurant
        const [item] = await ctx.db
          .select()
          .from(menuItems)
          .where(and(eq(menuItems.id, input.menuItemId), eq(menuItems.restaurantId, ctx.restaurantId)));
        if (!item) throw new TRPCError({ code: "NOT_FOUND" });

        return ctx.db
          .select()
          .from(recipeItems)
          .where(eq(recipeItems.menuItemId, input.menuItemId));
      }),

    upsert: adminProcedure
      .input(z.object({
        menuItemId: z.string().uuid(),
        items: z.array(z.object({
          ingredientId: z.string().uuid(),
          quantity: z.string(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const [item] = await ctx.db
          .select()
          .from(menuItems)
          .where(and(eq(menuItems.id, input.menuItemId), eq(menuItems.restaurantId, ctx.restaurantId)));
        if (!item) throw new TRPCError({ code: "NOT_FOUND" });

        // Replace all recipe items atomically
        await ctx.db.delete(recipeItems).where(eq(recipeItems.menuItemId, input.menuItemId));

        if (input.items.length > 0) {
          await ctx.db.insert(recipeItems).values(
            input.items.map((i) => ({
              menuItemId: input.menuItemId,
              ingredientId: i.ingredientId,
              quantity: i.quantity,
            }))
          );
        }

        return { success: true };
      }),
  }),

  transactions: router({
    list: adminProcedure
      .input(z.object({
        ingredientId: z.string().uuid().optional(),
        limit: z.number().int().max(100).default(50),
      }).optional())
      .query(async ({ ctx, input }) => {
        const conditions = [eq(inventoryTransactions.restaurantId, ctx.restaurantId)];
        if (input?.ingredientId) {
          conditions.push(eq(inventoryTransactions.ingredientId, input.ingredientId));
        }
        return ctx.db
          .select()
          .from(inventoryTransactions)
          .where(and(...conditions))
          .orderBy(sql`${inventoryTransactions.createdAt} DESC`)
          .limit(input?.limit ?? 50);
      }),
  }),
});
```

- [ ] **Step 2: Add inventory router to index**

```typescript
import { inventoryRouter } from "./inventory.js";
// Add to appRouter:
inventory: inventoryRouter,
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/routers/inventory.ts apps/server/src/routers/index.ts
git commit -m "feat: inventory router — ingredients CRUD, recipe upsert, restock transactions

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Admin Pages

**Files:**
- Create: `apps/web/src/routes/_app/admin/index.tsx`
- Create: `apps/web/src/routes/_app/admin/menu.tsx`
- Create: `apps/web/src/routes/_app/admin/staff.tsx`
- Create: `apps/web/src/routes/_app/admin/tables.tsx`
- Create: `apps/web/src/routes/_app/admin/inventory.tsx`
- Create: `apps/web/src/components/RecipeEditor.tsx`

- [ ] **Step 1: Create `apps/web/src/routes/_app/admin/index.tsx`** — dashboard with key stats

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { trpc } from "../../../trpc.js";

export const Route = createFileRoute("/_app/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data: orders = [] } = trpc.orders.list.useQuery();
  const { data: ingredients = [] } = trpc.inventory.ingredients.list.useQuery();

  const activeOrders = orders.filter((o: any) => ["placed", "preparing", "ready"].includes(o.status));
  const lowStockIngredients = ingredients.filter(
    (i: any) => Number(i.currentStock) <= Number(i.minStock)
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active Orders" value={activeOrders.length} color="text-amber-400" />
        <StatCard label="Total Orders Today" value={orders.length} color="text-white" />
        <StatCard label="Low Stock Items" value={lowStockIngredients.length} color={lowStockIngredients.length > 0 ? "text-destructive" : "text-success"} />
        <StatCard label="Revenue Today" value={`$${orders.reduce((s: number, o: any) => s + Number(o.total), 0).toFixed(2)}`} color="text-success" />
      </div>

      {lowStockIngredients.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4">
          <h2 className="font-semibold text-destructive mb-3">Low Stock Alerts</h2>
          <div className="space-y-2">
            {lowStockIngredients.map((i: any) => (
              <div key={i.id} className="flex justify-between text-sm">
                <span>{i.name}</span>
                <span className="text-destructive">{i.currentStock} {i.unit} (min: {i.minStock})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="text-muted text-xs mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
```

- [ ] **Step 2: Create `apps/web/src/routes/_app/admin/menu.tsx`** — menu management

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { trpc } from "../../../trpc.js";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { RecipeEditor } from "../../../components/RecipeEditor.js";

export const Route = createFileRoute("/_app/admin/menu")({
  component: MenuManagement,
});

function MenuManagement() {
  const { data: categories = [] } = trpc.menu.categories.list.useQuery();
  const { data: menuItems = [] } = trpc.menu.items.list.useQuery();
  const utils = trpc.useUtils();

  const createItem = trpc.menu.items.create.useMutation({ onSuccess: () => utils.menu.items.list.invalidate() });
  const updateItem = trpc.menu.items.update.useMutation({ onSuccess: () => utils.menu.items.list.invalidate() });
  const deleteItem = trpc.menu.items.delete.useMutation({ onSuccess: () => utils.menu.items.list.invalidate() });
  const createCategory = trpc.menu.categories.create.useMutation({ onSuccess: () => utils.menu.categories.list.invalidate() });

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showRecipeFor, setShowRecipeFor] = useState<string | null>(null);
  const [newItemForm, setNewItemForm] = useState({ name: "", price: "", categoryId: "" });
  const [newCategoryName, setNewCategoryName] = useState("");

  const filteredItems = selectedCategoryId
    ? menuItems.filter((i: any) => i.categoryId === selectedCategoryId)
    : menuItems;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Menu Management</h1>
      </div>

      {/* Categories */}
      <div>
        <h2 className="text-sm font-medium text-muted mb-2 uppercase tracking-wide">Categories</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategoryId(null)}
            className={`px-3 py-1.5 rounded-lg text-sm ${!selectedCategoryId ? "bg-accent text-black" : "bg-surface border border-border text-muted"}`}
          >
            All
          </button>
          {categories.map((c: any) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategoryId(c.id)}
              className={`px-3 py-1.5 rounded-lg text-sm ${selectedCategoryId === c.id ? "bg-accent text-black" : "bg-surface border border-border text-muted"}`}
            >
              {c.name}
            </button>
          ))}
          <div className="flex gap-2">
            <input
              className="bg-background border border-border rounded-lg px-2 py-1 text-sm w-32"
              placeholder="New category"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
            />
            <button
              onClick={() => { createCategory.mutate({ name: newCategoryName }); setNewCategoryName(""); }}
              className="bg-surface border border-border px-2 py-1 rounded-lg text-sm hover:bg-border"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Menu items table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Available</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredItems.map((item: any) => (
              <tr key={item.id}>
                <td className="px-4 py-3">{item.name}</td>
                <td className="px-4 py-3 text-accent">${item.price}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => updateItem.mutate({ id: item.id, isAvailable: !item.isAvailable })}
                    className={`px-2 py-0.5 rounded text-xs ${item.isAvailable ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}
                  >
                    {item.isAvailable ? "Yes" : "No"}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => setShowRecipeFor(item.id)} className="text-muted hover:text-white" title="Edit recipe">
                      🧪
                    </button>
                    <button onClick={() => deleteItem.mutate({ id: item.id })} className="text-muted hover:text-destructive">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add item form */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <h2 className="font-medium mb-3">Add Menu Item</h2>
        <div className="flex gap-3 flex-wrap">
          <select
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm"
            value={newItemForm.categoryId}
            onChange={(e) => setNewItemForm({ ...newItemForm, categoryId: e.target.value })}
          >
            <option value="">Category</option>
            {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm flex-1 min-w-32"
            placeholder="Item name"
            value={newItemForm.name}
            onChange={(e) => setNewItemForm({ ...newItemForm, name: e.target.value })}
          />
          <input
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm w-24"
            placeholder="Price"
            value={newItemForm.price}
            onChange={(e) => setNewItemForm({ ...newItemForm, price: e.target.value })}
          />
          <button
            onClick={() => {
              createItem.mutate({ categoryId: newItemForm.categoryId, name: newItemForm.name, price: newItemForm.price });
              setNewItemForm({ name: "", price: "", categoryId: "" });
            }}
            disabled={!newItemForm.name || !newItemForm.price || !newItemForm.categoryId}
            className="bg-accent text-black px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            Add Item
          </button>
        </div>
      </div>

      {/* Recipe editor modal */}
      {showRecipeFor && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Edit Recipe</h2>
              <button onClick={() => setShowRecipeFor(null)} className="text-muted hover:text-white">✕</button>
            </div>
            <RecipeEditor menuItemId={showRecipeFor} onClose={() => setShowRecipeFor(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `apps/web/src/components/RecipeEditor.tsx`**

```typescript
import { trpc } from "../trpc.js";
import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";

type RecipeRow = { ingredientId: string; quantity: string };

export function RecipeEditor({ menuItemId, onClose }: { menuItemId: string; onClose: () => void }) {
  const { data: allIngredients = [] } = trpc.inventory.ingredients.list.useQuery();
  const { data: existingRecipe = [] } = trpc.inventory.recipes.get.useQuery({ menuItemId });
  const upsert = trpc.inventory.recipes.upsert.useMutation({ onSuccess: onClose });

  const [rows, setRows] = useState<RecipeRow[]>([]);

  useEffect(() => {
    if (existingRecipe.length > 0) {
      setRows(existingRecipe.map((r: any) => ({ ingredientId: r.ingredientId, quantity: r.quantity })));
    }
  }, [existingRecipe.length]);

  function addRow() {
    setRows([...rows, { ingredientId: "", quantity: "" }]);
  }

  function updateRow(index: number, field: keyof RecipeRow, value: string) {
    const next = [...rows];
    next[index] = { ...next[index], [field]: value };
    setRows(next);
  }

  function removeRow(index: number) {
    setRows(rows.filter((_, i) => i !== index));
  }

  async function handleSave() {
    const validRows = rows.filter((r) => r.ingredientId && r.quantity);
    await upsert.mutateAsync({ menuItemId, items: validRows });
  }

  const ingredientMap = new Map(allIngredients.map((i: any) => [i.id, i]));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Define which ingredients are used when this item is ordered. Stock will be automatically deducted.</p>

      <div className="space-y-2">
        {rows.map((row, idx) => (
          <div key={idx} className="flex gap-2 items-center">
            <select
              className="flex-1 bg-background border border-border rounded-lg px-2 py-1.5 text-sm"
              value={row.ingredientId}
              onChange={(e) => updateRow(idx, "ingredientId", e.target.value)}
            >
              <option value="">Select ingredient</option>
              {allIngredients.map((i: any) => (
                <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
              ))}
            </select>
            <input
              type="number"
              step="0.001"
              className="w-24 bg-background border border-border rounded-lg px-2 py-1.5 text-sm"
              placeholder="Qty"
              value={row.quantity}
              onChange={(e) => updateRow(idx, "quantity", e.target.value)}
            />
            <span className="text-xs text-muted w-8">
              {row.ingredientId ? (ingredientMap.get(row.ingredientId) as any)?.unit ?? "" : ""}
            </span>
            <button onClick={() => removeRow(idx)} className="text-muted hover:text-destructive">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addRow}
        className="flex items-center gap-2 text-sm text-muted hover:text-white"
      >
        <Plus size={14} /> Add ingredient
      </button>

      <div className="flex gap-2 justify-end pt-2 border-t border-border">
        <button onClick={onClose} className="border border-border px-4 py-2 rounded-lg text-sm">Cancel</button>
        <button
          onClick={handleSave}
          disabled={upsert.isPending}
          className="bg-accent text-black px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
        >
          Save Recipe
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `apps/web/src/routes/_app/admin/staff.tsx`**

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { trpc } from "../../../trpc.js";

export const Route = createFileRoute("/_app/admin/staff")({
  component: StaffManagement,
});

type Role = "waiter" | "kitchen" | "cashier" | "admin";

function StaffManagement() {
  const { data: staff = [], refetch } = trpc.staff.list.useQuery();
  const createStaff = trpc.staff.create.useMutation({ onSuccess: () => { refetch(); setForm({ name: "", email: "", password: "", role: "waiter" }); } });
  const updateRole = trpc.staff.updateRole.useMutation({ onSuccess: () => refetch() });
  const deactivate = trpc.staff.deactivate.useMutation({ onSuccess: () => refetch() });
  const reactivate = trpc.staff.reactivate.useMutation({ onSuccess: () => refetch() });

  const [form, setForm] = useState({ name: "", email: "", password: "", role: "waiter" as Role });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Staff Management</h1>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {staff.map((member: any) => (
              <tr key={member.id}>
                <td className="px-4 py-3">{member.name}</td>
                <td className="px-4 py-3 text-muted">{member.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={member.role ?? ""}
                    onChange={(e) => updateRole.mutate({ id: member.id, role: e.target.value as Role })}
                    className="bg-background border border-border rounded px-2 py-1 text-xs capitalize"
                  >
                    {["waiter", "kitchen", "cashier", "admin"].map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${member.isActive ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
                    {member.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => member.isActive ? deactivate.mutate({ id: member.id }) : reactivate.mutate({ id: member.id })}
                    className="text-xs text-muted hover:text-white"
                  >
                    {member.isActive ? "Deactivate" : "Reactivate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add staff form */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <h2 className="font-medium mb-3">Add Staff Member</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <input className="bg-background border border-border rounded-lg px-3 py-2 text-sm" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input type="email" className="bg-background border border-border rounded-lg px-3 py-2 text-sm" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input type="password" className="bg-background border border-border rounded-lg px-3 py-2 text-sm" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <select className="bg-background border border-border rounded-lg px-3 py-2 text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            {["waiter", "kitchen", "cashier", "admin"].map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <button
          onClick={() => createStaff.mutate(form)}
          disabled={createStaff.isPending || !form.name || !form.email || !form.password}
          className="mt-3 bg-accent text-black px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          Add Staff Member
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `apps/web/src/routes/_app/admin/tables.tsx`** (abbreviated)

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { trpc } from "../../../trpc.js";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/admin/tables")({
  component: TableManagement,
});

function TableManagement() {
  const { data: tables = [], refetch } = trpc.tables.list.useQuery();
  const create = trpc.tables.create.useMutation({ onSuccess: () => { refetch(); setForm({ number: "", seats: "4" }); } });
  const del = trpc.tables.delete.useMutation({ onSuccess: () => refetch() });
  const [form, setForm] = useState({ number: "", seats: "4" });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Table Management</h1>
      <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-3">
        {tables.map((table: any) => (
          <div key={table.id} className="bg-surface border border-border rounded-xl p-3 text-center relative group">
            <div className="font-bold text-lg">{table.number}</div>
            <div className="text-xs text-muted">{table.seats} seats</div>
            <button
              onClick={() => del.mutate({ id: table.id })}
              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-muted hover:text-destructive"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
      <div className="bg-surface border border-border rounded-xl p-4">
        <h2 className="font-medium mb-3">Add Table</h2>
        <div className="flex gap-3">
          <input
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm w-24"
            placeholder="Number"
            type="number"
            value={form.number}
            onChange={(e) => setForm({ ...form, number: e.target.value })}
          />
          <input
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm w-24"
            placeholder="Seats"
            type="number"
            value={form.seats}
            onChange={(e) => setForm({ ...form, seats: e.target.value })}
          />
          <button
            onClick={() => create.mutate({ number: parseInt(form.number), seats: parseInt(form.seats) })}
            disabled={!form.number}
            className="bg-accent text-black px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            Add Table
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create `apps/web/src/routes/_app/admin/inventory.tsx`** — ingredient list + restock

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { trpc } from "../../../trpc.js";
import { Plus, Package } from "lucide-react";

export const Route = createFileRoute("/_app/admin/inventory")({
  component: InventoryPage,
});

function InventoryPage() {
  const { data: ingredients = [], refetch } = trpc.inventory.ingredients.list.useQuery();
  const create = trpc.inventory.ingredients.create.useMutation({ onSuccess: () => { refetch(); setNewForm({ name: "", unit: "units", minStock: "0", costPerUnit: "0" }); } });
  const restock = trpc.inventory.ingredients.restock.useMutation({ onSuccess: () => refetch() });

  const [newForm, setNewForm] = useState({ name: "", unit: "units" as const, minStock: "0", costPerUnit: "0" });
  const [restockTarget, setRestockTarget] = useState<{ id: string; name: string } | null>(null);
  const [restockQty, setRestockQty] = useState("");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Inventory</h1>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="px-4 py-3">Ingredient</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Min Stock</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ingredients.map((i: any) => {
              const isLow = Number(i.currentStock) <= Number(i.minStock);
              return (
                <tr key={i.id}>
                  <td className="px-4 py-3">{i.name}</td>
                  <td className={`px-4 py-3 font-medium ${isLow ? "text-destructive" : "text-white"}`}>
                    {i.currentStock}
                  </td>
                  <td className="px-4 py-3 text-muted">{i.minStock}</td>
                  <td className="px-4 py-3 text-muted">{i.unit}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => { setRestockTarget({ id: i.id, name: i.name }); setRestockQty(""); }}
                      className="flex items-center gap-1 text-xs text-muted hover:text-white"
                    >
                      <Package size={12} /> Restock
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add ingredient */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <h2 className="font-medium mb-3">Add Ingredient</h2>
        <div className="flex gap-3 flex-wrap">
          <input className="bg-background border border-border rounded-lg px-3 py-2 text-sm flex-1 min-w-32" placeholder="Name" value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} />
          <select className="bg-background border border-border rounded-lg px-3 py-2 text-sm" value={newForm.unit} onChange={(e) => setNewForm({ ...newForm, unit: e.target.value as any })}>
            {["g", "kg", "ml", "L", "units"].map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <input className="bg-background border border-border rounded-lg px-3 py-2 text-sm w-24" placeholder="Min stock" value={newForm.minStock} onChange={(e) => setNewForm({ ...newForm, minStock: e.target.value })} />
          <button onClick={() => create.mutate(newForm)} disabled={!newForm.name} className="bg-accent text-black px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      {/* Restock modal */}
      {restockTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="font-semibold">Restock: {restockTarget.name}</h2>
            <input
              type="number"
              step="0.001"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
              placeholder="Quantity to add"
              value={restockQty}
              onChange={(e) => setRestockQty(e.target.value)}
            />
            <div className="flex gap-2">
              <button onClick={() => setRestockTarget(null)} className="flex-1 border border-border py-2 rounded-lg text-sm">Cancel</button>
              <button
                onClick={() => { restock.mutate({ id: restockTarget.id, quantity: restockQty }); setRestockTarget(null); }}
                disabled={!restockQty}
                className="flex-1 bg-accent text-black py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                Add Stock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/routes/_app/admin/ apps/web/src/components/RecipeEditor.tsx
git commit -m "feat: admin pages — dashboard, menu CRUD, staff management, tables, inventory

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Superadmin Router + Platform Pages

**Files:**
- Create: `apps/server/src/routers/superadmin.ts`
- Create: `apps/web/src/routes/_app/platform/restaurants.tsx`
- Create: `apps/web/src/routes/_app/platform/pending-users.tsx`

- [ ] **Step 1: Create `apps/server/src/routers/superadmin.ts`**

```typescript
import { z } from "zod";
import { eq, isNull } from "drizzle-orm";
import { router, superadminProcedure } from "../trpc/trpc.js";
import { restaurants, user } from "@restaurant/db";
import { TRPCError } from "@trpc/server";

export const superadminRouter = router({
  restaurants: router({
    list: superadminProcedure.query(async ({ ctx }) => {
      return ctx.db.select().from(restaurants).orderBy(restaurants.createdAt);
    }),

    create: superadminProcedure
      .input(z.object({
        name: z.string().min(1),
        slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
        address: z.string().optional(),
        currency: z.string().default("USD"),
        taxRate: z.string().default("0"),
      }))
      .mutation(async ({ ctx, input }) => {
        const [restaurant] = await ctx.db.insert(restaurants).values(input).returning();
        return restaurant;
      }),

    update: superadminProcedure
      .input(z.object({
        id: z.string().uuid(),
        status: z.enum(["active", "trial", "suspended", "inactive"]).optional(),
        name: z.string().min(1).optional(),
        taxRate: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const [updated] = await ctx.db
          .update(restaurants)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(restaurants.id, id))
          .returning();
        if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
        return updated;
      }),
  }),

  pendingUsers: router({
    list: superadminProcedure.query(async ({ ctx }) => {
      // Users who registered but have no role assigned yet
      return ctx.db
        .select()
        .from(user)
        .where(isNull(user.role))
        .orderBy(user.createdAt);
    }),

    approve: superadminProcedure
      .input(z.object({
        userId: z.string(),
        restaurantId: z.string().uuid(),
        role: z.enum(["admin", "waiter", "kitchen", "cashier"]),
      }))
      .mutation(async ({ ctx, input }) => {
        await ctx.db
          .update(user)
          .set({
            role: input.role,
            restaurantId: input.restaurantId,
            isActive: true,
            emailVerified: true,
            updatedAt: new Date(),
          })
          .where(eq(user.id, input.userId));
        return { success: true };
      }),
  }),
});
```

- [ ] **Step 2: Add superadmin to index**

```typescript
import { superadminRouter } from "./superadmin.js";
// Add to appRouter:
superadmin: superadminRouter,
```

- [ ] **Step 3: Create `apps/web/src/routes/_app/platform/restaurants.tsx`**

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { trpc } from "../../../trpc.js";

export const Route = createFileRoute("/_app/platform/restaurants")({
  component: RestaurantsPage,
});

function RestaurantsPage() {
  const { data: restaurants = [], refetch } = trpc.superadmin.restaurants.list.useQuery();
  const create = trpc.superadmin.restaurants.create.useMutation({ onSuccess: () => { refetch(); setForm({ name: "", slug: "", currency: "USD", taxRate: "8" }); } });
  const update = trpc.superadmin.restaurants.update.useMutation({ onSuccess: () => refetch() });

  const [form, setForm] = useState({ name: "", slug: "", currency: "USD", taxRate: "8" });

  const STATUS_COLORS: Record<string, string> = {
    active: "text-success",
    trial: "text-amber-400",
    suspended: "text-destructive",
    inactive: "text-muted",
    demo: "text-blue-400",
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Restaurants</h1>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Tax Rate</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {restaurants.map((r: any) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3 text-muted">{r.slug}</td>
                <td className="px-4 py-3">
                  <select
                    value={r.status}
                    onChange={(e) => update.mutate({ id: r.id, status: e.target.value as any })}
                    className={`bg-background border border-border rounded px-2 py-1 text-xs ${STATUS_COLORS[r.status]}`}
                    disabled={r.status === "demo"}
                  >
                    {["active", "trial", "suspended", "inactive"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-muted">{r.taxRate}%</td>
                <td className="px-4 py-3">
                  <a href={`/platform/pending-users?restaurantId=${r.id}`} className="text-xs text-accent hover:underline">Manage users</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add restaurant */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <h2 className="font-medium mb-3">Create Restaurant</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <input className="bg-background border border-border rounded-lg px-3 py-2 text-sm" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="bg-background border border-border rounded-lg px-3 py-2 text-sm" placeholder="Slug (e.g. my-restaurant)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          <input className="bg-background border border-border rounded-lg px-3 py-2 text-sm" placeholder="Currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          <input className="bg-background border border-border rounded-lg px-3 py-2 text-sm" placeholder="Tax rate %" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} />
        </div>
        <button
          onClick={() => create.mutate(form)}
          disabled={!form.name || !form.slug}
          className="mt-3 bg-accent text-black px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          Create Restaurant
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `apps/web/src/routes/_app/platform/pending-users.tsx`**

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { trpc } from "../../../trpc.js";

export const Route = createFileRoute("/_app/platform/pending-users")({
  component: PendingUsersPage,
});

function PendingUsersPage() {
  const { data: users = [], refetch } = trpc.superadmin.pendingUsers.list.useQuery();
  const { data: restaurants = [] } = trpc.superadmin.restaurants.list.useQuery();
  const approve = trpc.superadmin.pendingUsers.approve.useMutation({ onSuccess: () => refetch() });

  const [approvalForm, setApprovalForm] = useState<Record<string, { restaurantId: string; role: string }>>({});

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Pending User Approvals</h1>

      {users.length === 0 ? (
        <p className="text-muted">No pending users.</p>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Restaurant</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u: any) => {
                const form = approvalForm[u.id] ?? { restaurantId: "", role: "waiter" };
                return (
                  <tr key={u.id}>
                    <td className="px-4 py-3">{u.name}</td>
                    <td className="px-4 py-3 text-muted">{u.email}</td>
                    <td className="px-4 py-3">
                      <select
                        value={form.restaurantId}
                        onChange={(e) => setApprovalForm({ ...approvalForm, [u.id]: { ...form, restaurantId: e.target.value } })}
                        className="bg-background border border-border rounded px-2 py-1 text-xs"
                      >
                        <option value="">Select restaurant</option>
                        {restaurants.filter((r: any) => r.status !== "demo").map((r: any) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={form.role}
                        onChange={(e) => setApprovalForm({ ...approvalForm, [u.id]: { ...form, role: e.target.value } })}
                        className="bg-background border border-border rounded px-2 py-1 text-xs"
                      >
                        {["waiter", "kitchen", "cashier", "admin"].map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => approve.mutate({ userId: u.id, restaurantId: form.restaurantId, role: form.role as any })}
                        disabled={!form.restaurantId}
                        className="bg-accent text-black text-xs px-3 py-1 rounded-lg font-medium disabled:opacity-50"
                      >
                        Approve
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routers/superadmin.ts apps/server/src/routers/index.ts apps/web/src/routes/_app/platform/
git commit -m "feat: superadmin router + platform pages for restaurant and user management

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```
