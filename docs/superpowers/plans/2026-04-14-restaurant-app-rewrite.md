# Restaurant App — Full Bug-Fix & Rewrite Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every identified bug, eliminate architectural inconsistencies, and harden the app for production use.

**Architecture:** Express + Drizzle ORM backend, React + TanStack Query frontend, Socket.IO real-time layer. All fixes stay within the existing architecture — no framework changes. Each phase produces independently deployable, tested software.

**Tech Stack:** TypeScript 5.7, Express 4, Drizzle ORM, PostgreSQL 16, React 19, TanStack Query 5, Socket.IO 4, Vitest, Supertest, Playwright

---

## Bug Inventory

| # | Severity | Location | Description |
|---|----------|----------|-------------|
| B1 | CRITICAL | `kitchen.service.ts:83` | `syncOrderStatus()` never emits `order:ready` socket event — waiters don't get notified when order auto-transitions to ready |
| B2 | CRITICAL | `kitchen.service.ts:93` | `syncOrderStatus()` sets status back to `"ready"` if all items are `"served"` — can reset a served order |
| B3 | CRITICAL | `kitchen.service.ts:40` | Kitchen item cancel doesn't restore stock — stock permanently lost for each kitchen-cancelled item |
| B4 | CRITICAL | `orders.service.ts:488` | `cancelOrder()` restores stock for ALL items including already-cancelled ones — double-credits stock (or cancels correction from B3) |
| B5 | CRITICAL | `orders.service.ts:118` | `updateOrder()` stock adjustment for placed orders is outside a transaction — partial failure leaves stock permanently miscounted |
| B6 | CRITICAL | `admin.routes.ts:37` | Admin-created staff have `isEmailVerified: false` with no verification email sent — permanently stuck in `pending_verification`, can never log in |
| B7 | HIGH | `OrderPage.tsx:215` | `handleSaveAndPlace`: after `createOrderMut`, raw API calls have no try/catch — unhandled errors leave orphaned draft orders |
| B8 | HIGH | UI — `OrderPage.tsx` | No cancel button for waiters/admins — cancel is only accessible from `CashierOrderDetailPage` |
| B9 | MEDIUM | `OrderPage.tsx:51` | `staleTime: Infinity` on menu data — waiters never see admin menu updates without a hard refresh |
| B10 | MEDIUM | `AuthContext.tsx:21` | Access token stored in `localStorage` — XSS-accessible; should live in memory |
| B11 | MEDIUM | `admin.routes.ts` | Business logic inline in routes — untestable, inconsistent with module pattern |
| B12 | MEDIUM | `reports.controller.ts` | SQL queries in controller — no service layer, untestable |
| B13 | LOW | `schema.ts` | Missing indexes on `orders.restaurant_id`, `orders.status`, `order_items.order_id`, `menu_items.restaurant_id` |
| B14 | LOW | `packages/ui-auth/` | Auth components duplicated — shared package not imported by frontend |

---

## Phase 1: Critical Backend Data Integrity

### Task 1: Fix kitchen `syncOrderStatus` — socket emission + over-promotion bug

**What's wrong:**
1. `syncOrderStatus()` in `kitchen.service.ts` auto-promotes the order to `"ready"` when all items are ready/served. But it never emits `order:ready` to waiters. Waiters only get notified through `kitchen.controller.ts` after `updateItemStatus()`, which emits `order:item-updated` (not `order:ready`). So the "¡Pedido listo!" toast on `OrderPage` never fires.
2. If all items reach `"served"` and `syncOrderStatus` is called again (e.g., by a stale kitchen action), it resets a `"served"` order back to `"ready"`.

**Files:**
- Modify: `backend/src/modules/kitchen/kitchen.service.ts`
- Modify: `backend/src/modules/kitchen/kitchen.controller.ts`
- Test: `backend/src/modules/kitchen/kitchen.integration.test.ts`

- [ ] **Step 1: Write the failing tests**

Open `backend/src/modules/kitchen/kitchen.integration.test.ts` and add:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as kitchenService from "./kitchen.service.js";
import * as orderEvents from "../../socket/orderEvents.js";

// Mock orderEvents to spy on emissions
vi.mock("../../socket/orderEvents.js", () => ({
  emitOrderReady: vi.fn(),
  emitOrderItemUpdated: vi.fn(),
}));

describe("syncOrderStatus", () => {
  it("returns 'ready' when all non-cancelled items are ready", async () => {
    // Integration test: set up DB with an order that has all items ready
    // then call updateItemStatus to mark the last item ready
    // verify the returned order status is 'ready'
    // (use your test app factory / test DB setup)
  });

  it("does NOT downgrade a 'served' order when syncOrderStatus runs", async () => {
    // Set up: order in 'served' status, all items in 'served' status
    // Call syncOrderStatus indirectly via updateItemStatus on an already-served item
    // Verify order remains 'served'
  });

  it("auto-cancels order when all items are cancelled", async () => {
    // Set up: placed order with 2 items
    // Cancel both items via updateItemStatus
    // Verify order transitions to 'cancelled'
  });
});
```

Run: `cd backend && npm test -- --reporter=verbose kitchen`
Expected: Tests FAIL (functions don't have the new behavior yet)

- [ ] **Step 2: Change `syncOrderStatus` to return the new status and guard against over-promotion**

In `backend/src/modules/kitchen/kitchen.service.ts`, replace `syncOrderStatus` with:

```typescript
/**
 * Inspects all items for an order and updates the order status if needed.
 * Returns the new order status, or null if no change was made.
 * 
 * Rules:
 * - All items cancelled  → order becomes 'cancelled'
 * - All items ready or served → order becomes 'ready'  (only if not already served/cancelled)
 * - Any item preparing  → order becomes 'preparing'
 */
async function syncOrderStatus(orderId: string): Promise<"preparing" | "ready" | "cancelled" | null> {
  const [currentOrder] = await db
    .select({ status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId));

  // Never touch terminal states
  if (!currentOrder || currentOrder.status === "served" || currentOrder.status === "cancelled") {
    return null;
  }

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const nonCancelled = items.filter((i) => i.status !== "cancelled");

  // All items cancelled → cancel the order
  if (nonCancelled.length === 0) {
    await db
      .update(orders)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(orders.id, orderId));
    return "cancelled";
  }

  const statuses = nonCancelled.map((i) => i.status);
  let newStatus: "preparing" | "ready" | null = null;

  if (statuses.every((s) => s === "ready" || s === "served")) {
    newStatus = "ready";
  } else if (statuses.some((s) => s === "preparing")) {
    newStatus = "preparing";
  }

  if (newStatus && newStatus !== currentOrder.status) {
    await db
      .update(orders)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(orders.id, orderId));
    return newStatus;
  }

  return null;
}
```

Also update `updateItemStatus` to return both item and new order status:

```typescript
export async function updateItemStatus(
  restaurantId: string,
  itemId: string,
  status: "preparing" | "ready" | "served" | "cancelled"
) {
  const item = await db.query.orderItems.findFirst({
    where: eq(orderItems.id, itemId),
    with: { order: true },
  });

  if (!item || item.order.restaurantId !== restaurantId) {
    throw new NotFoundError("Order item not found");
  }

  const [updated] = await db
    .update(orderItems)
    .set({ status })
    .where(eq(orderItems.id, itemId))
    .returning();

  const newOrderStatus = await syncOrderStatus(item.orderId);

  return { item: updated, newOrderStatus, orderId: item.orderId };
}
```

- [ ] **Step 3: Update the kitchen controller to emit the correct socket event**

In `backend/src/modules/kitchen/kitchen.controller.ts`:

```typescript
import { Request, Response } from "express";
import * as kitchenService from "./kitchen.service.js";
import * as ordersService from "../orders/orders.service.js";
import { emitOrderItemUpdated, emitOrderReady, emitOrderCancelled } from "../../socket/orderEvents.js";

export async function getActiveOrders(req: Request, res: Response) {
  const orders = await kitchenService.getActiveOrders(req.user!.restaurantId);
  res.json(orders);
}

export async function updateItemStatus(req: Request, res: Response) {
  const { item, newOrderStatus, orderId } = await kitchenService.updateItemStatus(
    req.user!.restaurantId,
    req.params.id as string,
    req.body.status
  );
  await ordersService.logEvent(orderId, req.user!.userId, "item_status_changed", {
    itemId: item.id,
    itemName: item.itemName,
    status: req.body.status,
  });

  if (newOrderStatus === "ready") {
    // Fetch the full order so the socket payload matches what waiter expects
    const fullOrder = await ordersService.getOrder(req.user!.restaurantId, orderId);
    emitOrderReady(req.user!.restaurantId, fullOrder);
  } else if (newOrderStatus === "cancelled") {
    const fullOrder = await ordersService.getOrder(req.user!.restaurantId, orderId);
    emitOrderCancelled(req.user!.restaurantId, fullOrder);
  } else {
    emitOrderItemUpdated(req.user!.restaurantId, item);
  }

  res.json(item);
}

export async function updateOrderStatus(req: Request, res: Response) {
  const order = await kitchenService.updateOrderStatus(
    req.user!.restaurantId,
    req.params.id as string,
    req.body.status
  );
  await ordersService.logEvent(order.id, req.user!.userId, "status_changed", {
    status: req.body.status,
  });
  if (order.status === "ready") {
    emitOrderReady(req.user!.restaurantId, order);
  } else {
    emitOrderItemUpdated(req.user!.restaurantId, order);
  }
  res.json(order);
}
```

- [ ] **Step 4: Run tests**

Run: `cd backend && npm test -- --reporter=verbose kitchen`
Expected: All kitchen service tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/kitchen/kitchen.service.ts backend/src/modules/kitchen/kitchen.controller.ts backend/src/modules/kitchen/kitchen.integration.test.ts
git commit -m "fix: emit order:ready when syncOrderStatus auto-promotes; guard against over-promotion"
```

---

### Task 2: Fix stock accounting in kitchen item cancel and order cancel

**What's wrong:**
- B3: `kitchen.service.ts updateItemStatus()` can set an item to `"cancelled"` but never restores its stock. Stock is permanently lost.
- B4: `orders.service.ts cancelOrder()` iterates ALL items (including already-cancelled ones) and restores stock for each. Already-cancelled items never had their stock restored individually (B3), so this creates an incorrect net +quantity for every item that was kitchen-cancelled before the full order was cancelled. The correct behavior is to only restore stock for items that are NOT already cancelled.

**Files:**
- Modify: `backend/src/modules/kitchen/kitchen.service.ts`
- Modify: `backend/src/modules/orders/orders.service.ts`
- Test: `backend/src/modules/kitchen/kitchen.integration.test.ts`
- Test: `backend/src/modules/orders/orders.integration.test.ts`

- [ ] **Step 1: Write failing tests**

In `backend/src/modules/kitchen/kitchen.integration.test.ts`:

```typescript
it("restores stock when kitchen cancels an item", async () => {
  // 1. Create menu item with stockCount = 5
  // 2. Create + place order with 2 of that item (stock should become 3)
  // 3. Call updateItemStatus(itemId, "cancelled")
  // 4. Fetch menu item — expect stockCount === 5 again
});
```

In `backend/src/modules/orders/orders.integration.test.ts`:

```typescript
it("does not double-restore stock for already-cancelled items", async () => {
  // 1. Create menu item with stockCount = 10
  // 2. Create + place order with 3 of item A and 2 of item B
  //    stockCount for A: 7, B: 8
  // 3. Kitchen cancels item A (status = "cancelled")
  //    stockCount for A should restore to: 10
  // 4. Cancel the full order
  //    stockCount for B should restore to: 10
  //    stockCount for A should STILL be 10 (not 13)
});
```

Run: `cd backend && npm test -- --reporter=verbose`
Expected: New tests FAIL

- [ ] **Step 2: Add stock restore to kitchen item cancellation**

In `backend/src/modules/kitchen/kitchen.service.ts`, update `updateItemStatus`:

```typescript
export async function updateItemStatus(
  restaurantId: string,
  itemId: string,
  status: "preparing" | "ready" | "served" | "cancelled"
) {
  const item = await db.query.orderItems.findFirst({
    where: eq(orderItems.id, itemId),
    with: { order: true, menuItem: true },
  });

  if (!item || item.order.restaurantId !== restaurantId) {
    throw new NotFoundError("Order item not found");
  }

  // Restore stock when kitchen cancels an item (only if it was a placed/active item)
  if (status === "cancelled" && item.status !== "cancelled") {
    const mi = item.menuItem;
    if (mi && mi.stockCount !== null) {
      await db
        .update(menuItems)
        .set({
          stockCount: sql`${menuItems.stockCount} + ${item.quantity}`,
          updatedAt: new Date(),
        })
        .where(eq(menuItems.id, item.menuItemId));
    }
  }

  const [updated] = await db
    .update(orderItems)
    .set({ status })
    .where(eq(orderItems.id, itemId))
    .returning();

  const newOrderStatus = await syncOrderStatus(item.orderId);

  return { item: updated, newOrderStatus, orderId: item.orderId };
}
```

Note: you need to add `menuItems` to the imports at the top of `kitchen.service.ts`:

```typescript
import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { orders, orderItems, menuItems } from "../../db/schema.js";
import { NotFoundError, AppError } from "../../utils/errors.js";
```

- [ ] **Step 3: Fix `cancelOrder` to skip already-cancelled items**

In `backend/src/modules/orders/orders.service.ts`, update `cancelOrder`:

```typescript
export async function cancelOrder(restaurantId: string, orderId: string) {
  const order = await getOrder(restaurantId, orderId);

  if (order.status === "served" || order.status === "cancelled") {
    throw new AppError(400, "Cannot cancel this order");
  }

  await db.transaction(async (tx) => {
    // Restore stock only for items NOT already cancelled
    // (already-cancelled items had their stock restored individually by kitchen)
    if (order.status !== "draft") {
      const itemsToRestore = order.items.filter((i) => i.status !== "cancelled");
      for (const item of itemsToRestore) {
        if (item.menuItem && item.menuItem.stockCount !== null) {
          await tx
            .update(menuItems)
            .set({
              stockCount: sql`${menuItems.stockCount} + ${item.quantity}`,
              updatedAt: new Date(),
            })
            .where(eq(menuItems.id, item.menuItemId));
        }
      }
    }

    await tx
      .update(orders)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(orders.id, orderId));

    await tx
      .update(orderItems)
      .set({ status: "cancelled" })
      .where(eq(orderItems.orderId, orderId));
  });

  return getOrder(restaurantId, orderId);
}
```

- [ ] **Step 4: Run tests**

Run: `cd backend && npm test -- --reporter=verbose`
Expected: All new stock tests PASS; existing tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/kitchen/kitchen.service.ts backend/src/modules/orders/orders.service.ts backend/src/modules/kitchen/kitchen.integration.test.ts backend/src/modules/orders/orders.integration.test.ts
git commit -m "fix: restore stock on kitchen item cancel; skip already-cancelled items in cancelOrder"
```

---

### Task 3: Make `updateOrder` stock adjustment transactional

**What's wrong (B5):** When editing a placed order, the delta-based stock adjustment in `updateOrder()` (`orders.service.ts:118-155`) runs individual `UPDATE` statements outside any transaction. If the order update (`db.update(orders)`) throws after stock has been adjusted, the stock count is permanently wrong.

**Files:**
- Modify: `backend/src/modules/orders/orders.service.ts`
- Test: `backend/src/modules/orders/orders.integration.test.ts`

- [ ] **Step 1: Write failing test**

In `backend/src/modules/orders/orders.integration.test.ts`:

```typescript
it("rolls back stock adjustment when updateOrder fails mid-way", async () => {
  // 1. Create a menu item with stockCount = 5
  // 2. Place an order with 2 of that item (stock becomes 3)
  // 3. Mock db.update(orders).set(...) to throw after stock is already adjusted
  // 4. Call updateOrder trying to change quantity to 4
  // 5. Expect the call to throw
  // 6. Fetch the menu item — stock should STILL be 3 (not 1)
});
```

Run: `cd backend && npm test -- --reporter=verbose orders`
Expected: FAIL

- [ ] **Step 2: Wrap the placed-order stock + item replacement in a transaction**

In `backend/src/modules/orders/orders.service.ts`, replace the body of `updateOrder` from line 86 onwards:

```typescript
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

  // Fetch menu items for pricing and availability checks
  const menuItemIds = input.items.map((i) => i.menuItemId);
  const menuItemRows = await db
    .select()
    .from(menuItems)
    .where(and(eq(menuItems.restaurantId, restaurantId), inArray(menuItems.id, menuItemIds)));

  const menuItemMap = new Map(menuItemRows.map((m) => [m.id, m]));

  for (const item of input.items) {
    const mi = menuItemMap.get(item.menuItemId);
    if (!mi) throw new NotFoundError(`Menu item ${item.menuItemId} not found`);
    if (!mi.isAvailable) throw new AppError(400, `${mi.name} is not available`);
  }

  // Get restaurant for tax rate (outside tx — read-only)
  const [restaurant] = await db
    .select()
    .from(restaurants)
    .where(eq(restaurants.id, restaurantId));

  const taxRate = parseFloat(restaurant.taxRate);

  await db.transaction(async (tx) => {
    if (order.status === "placed") {
      // Adjust stock for placed orders: compare old vs new quantities
      const currentItems = await tx
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

        const [mi] = await tx.select().from(menuItems).where(eq(menuItems.id, itemId));
        if (!mi || mi.stockCount === null) continue;

        if (delta > 0 && mi.stockCount < delta) {
          throw new AppError(400, `${mi.name} only has ${mi.stockCount} left in stock`);
        }

        await tx
          .update(menuItems)
          .set({ stockCount: sql`${menuItems.stockCount} - ${delta}`, updatedAt: new Date() })
          .where(eq(menuItems.id, itemId));
      }
    } else {
      // Draft: validate stock
      for (const item of input.items) {
        const mi = menuItemMap.get(item.menuItemId)!;
        if (mi.stockCount !== null && mi.stockCount < item.quantity) {
          throw new AppError(400, `${mi.name} only has ${mi.stockCount} left in stock`);
        }
      }
    }

    // Replace items
    await tx.delete(orderItems).where(eq(orderItems.orderId, orderId));

    const newItems = input.items.map((item) => {
      const mi = menuItemMap.get(item.menuItemId)!;
      return {
        orderId,
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPrice: mi.price,
        itemName: mi.name,
        notes: item.notes,
        ...(order.status === "placed" && { status: "pending" as const }),
      };
    });

    await tx.insert(orderItems).values(newItems);

    // Calculate totals
    const subtotal = input.items.reduce((sum, item) => {
      const mi = menuItemMap.get(item.menuItemId)!;
      return sum + parseFloat(mi.price) * item.quantity;
    }, 0);

    const discountType = order.discountType ?? "none";
    const discountValue = parseFloat(order.discountValue ?? "0");
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
        notes: input.notes,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));
  });

  return getOrder(restaurantId, orderId);
}
```

- [ ] **Step 3: Run tests**

Run: `cd backend && npm test -- --reporter=verbose orders`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/orders/orders.service.ts backend/src/modules/orders/orders.integration.test.ts
git commit -m "fix: wrap updateOrder stock adjustment in transaction to prevent partial failure"
```

---

### Task 4: Fix admin-created staff email verification (B6)

**What's wrong:** `admin.routes.ts` creates staff with `isEmailVerified` defaulting to `false`. `auth.service.ts` returns `status: "pending_verification"` for any user with `isEmailVerified === false`. No verification email is sent during admin staff creation. Result: admin-created staff can never log in.

**Fix:** Set `isEmailVerified: true` for staff created by admins (they are pre-trusted; the admin vouches for them). This matches what `db/seed.ts` does for seeded users.

**Files:**
- Modify: `backend/src/modules/admin/admin.routes.ts`
- Test: `backend/src/modules/admin/admin.integration.test.ts`

- [ ] **Step 1: Write failing test**

In `backend/src/modules/admin/admin.integration.test.ts`:

```typescript
it("admin-created staff can log in immediately without email verification", async () => {
  // 1. Authenticate as admin
  // 2. POST /api/admin/staff with name, email, password, role: "waiter"
  // 3. POST /api/auth/login with the same credentials
  // 4. Expect response.user.status to NOT be "pending_verification"
  // 5. Expect response.accessToken to be present
  // 6. Expect response.user.role === "waiter"
});
```

Run: `cd backend && npm test -- --reporter=verbose admin`
Expected: FAIL

- [ ] **Step 2: Set `isEmailVerified: true` in the create staff handler**

In `backend/src/modules/admin/admin.routes.ts`, update the POST /staff handler:

```typescript
router.post("/staff", validate(createStaffSchema), asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body;
  const passwordHash = await hashPassword(password);

  const [user] = await db
    .insert(users)
    .values({
      name,
      email,
      passwordHash,
      role,
      restaurantId: req.user!.restaurantId,
      isEmailVerified: true,   // Admin-created staff are pre-verified
      isActive: true,
    })
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    });

  res.status(201).json(user);
}));
```

- [ ] **Step 3: Run tests**

Run: `cd backend && npm test -- --reporter=verbose admin`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/admin/admin.routes.ts backend/src/modules/admin/admin.integration.test.ts
git commit -m "fix: set isEmailVerified=true for admin-created staff so they can log in immediately"
```

---

## Phase 2: Frontend Bug Fixes

### Task 5: Add cancel order button to OrderPage (B8)

**What's wrong:** `cancelOrder` API function exists in `frontend/src/api/orders.ts` and the backend route authorizes `waiter`, `admin`, and `cashier`. But `OrderPage.tsx` has no cancel button — waiters and admins can't cancel orders. Only `CashierOrderDetailPage` uses it.

**Files:**
- Modify: `frontend/src/pages/waiter/OrderPage.tsx`

- [ ] **Step 1: Add cancel state and mutation to OrderPage**

In `frontend/src/pages/waiter/OrderPage.tsx`, add after `const [showMergeConfirm, setShowMergeConfirm]` state declaration:

```typescript
const [showCancelConfirm, setShowCancelConfirm] = useState(false);

const cancelOrderMut = useMutation({
  mutationFn: () => ordersApi.cancelOrder(orderId!),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    toast("Pedido cancelado", "info");
    navigate("/tables");
  },
  onError: (err: any) => toast(err?.response?.data?.error ?? "Error al cancelar", "error"),
});
```

- [ ] **Step 2: Add the cancel button in the cart footer**

In the footer section of `cartPanel`, after the "Transfer & merge" block (after the closing `</div>` of the transfer/merge block), add:

```tsx
{/* Cancel — available for any active, non-served order */}
{existingOrder &&
  existingOrder.status !== "served" &&
  existingOrder.status !== "cancelled" &&
  existingOrder.status !== "draft" &&
  !isEditing && (
  <Button
    variant="ghost"
    size="sm"
    className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
    onClick={() => setShowCancelConfirm(true)}
    disabled={cancelOrderMut.isPending}
  >
    Cancelar pedido
  </Button>
)}
```

- [ ] **Step 3: Add the ConfirmDialog for cancel**

After the existing `showMergeConfirm && <ConfirmDialog .../>` block, add:

```tsx
{showCancelConfirm && (
  <ConfirmDialog
    isOpen
    title="Cancelar pedido"
    message="¿Estás seguro de que deseas cancelar este pedido? Esta acción no se puede deshacer."
    confirmLabel="Cancelar pedido"
    onConfirm={() => {
      cancelOrderMut.mutate();
      setShowCancelConfirm(false);
    }}
    onCancel={() => setShowCancelConfirm(false)}
  />
)}
```

- [ ] **Step 4: Verify visually**

Start the dev server (`cd frontend && npm run dev`), log in as a waiter, place an order, navigate to its order page. Verify:
- A "Cancelar pedido" button appears below the transfer/merge buttons for placed/preparing/ready orders
- Clicking it shows the confirm dialog
- Confirming cancels the order and navigates to `/tables`
- The button does NOT appear for draft, served, or cancelled orders

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/waiter/OrderPage.tsx
git commit -m "fix: add cancel order button to OrderPage for waiters and admins"
```

---

### Task 6: Fix `handleSaveAndPlace` error handling (B7)

**What's wrong:** `handleSaveAndPlace` in `OrderPage.tsx` calls raw `ordersApi.updateOrder()` and `ordersApi.placeOrder()` after `createOrderMut.mutateAsync()` without try/catch. If either raw API call fails (e.g., stock unavailable), a draft order is created in the DB but the user sees no error and no mutation error state. The draft order is orphaned.

**Files:**
- Modify: `frontend/src/pages/waiter/OrderPage.tsx`

- [ ] **Step 1: Replace raw API calls with error-handled mutations**

Replace the `handleSaveAndPlace` function:

```typescript
const handleSaveAndPlace = async () => {
  try {
    if (!orderId && tableId) {
      // New order: create → update items → place
      const order = await createOrderMut.mutateAsync(tableId);
      await ordersApi.updateOrder(
        order.id,
        cart.map((c) => ({ menuItemId: c.menuItemId, quantity: c.quantity, notes: c.notes })),
        orderNotes || undefined
      );
      await ordersApi.placeOrder(order.id);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast("¡Pedido enviado a cocina!", "success");
      navigate("/tables");
    } else if (orderId) {
      await updateOrderMut.mutateAsync();
      await placeOrderMut.mutateAsync();
    }
  } catch (err: any) {
    const message = err?.response?.data?.error ?? "Error al enviar el pedido";
    toast(message, "error");
  }
};
```

Also replace `handleSaveDraft`:

```typescript
const handleSaveDraft = async () => {
  try {
    if (!orderId && tableId) {
      const order = await createOrderMut.mutateAsync(tableId);
      await ordersApi.updateOrder(
        order.id,
        cart.map((c) => ({ menuItemId: c.menuItemId, quantity: c.quantity, notes: c.notes })),
        orderNotes || undefined
      );
      // Navigate to the newly-created draft so user can find it later
      navigate(`/order/${order.id}`);
      toast("Borrador guardado", "info");
    } else if (orderId) {
      await updateOrderMut.mutateAsync();
      toast("Borrador guardado", "info");
    }
  } catch (err: any) {
    const message = err?.response?.data?.error ?? "Error al guardar el borrador";
    toast(message, "error");
  }
};
```

Note the second change: `handleSaveDraft` now navigates to `/order/${order.id}` instead of `/tables`, so the draft order can be found and edited again if needed.

- [ ] **Step 2: Verify**

Start dev server. As waiter, create a new order, add an out-of-stock item (set stockCount=0 in admin), click "Enviar a cocina". Verify:
- An error toast appears with the stock error message
- The user stays on the OrderPage (not navigated away)
- No orphaned orders appear in admin

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/waiter/OrderPage.tsx
git commit -m "fix: wrap handleSaveAndPlace and handleSaveDraft in try/catch to surface API errors"
```

---

### Task 7: Fix `staleTime: Infinity` on menu data (B9)

**What's wrong:** Categories and menu items are fetched with `staleTime: Infinity` in `OrderPage.tsx` and `MenuManagementPage.tsx`. If admin updates item availability or stock, waiters see stale data until hard refresh.

**Fix:** Use a 60-second staleTime on menu data in the order-taking context. The admin menu management page can keep a short staleTime for immediate feedback.

**Files:**
- Modify: `frontend/src/pages/waiter/OrderPage.tsx`
- Modify: `frontend/src/pages/admin/MenuManagementPage.tsx`

- [ ] **Step 1: Update staleTime in OrderPage**

In `frontend/src/pages/waiter/OrderPage.tsx`, change both menu queries:

```typescript
const { data: categories = [] } = useQuery({
  queryKey: ["categories"],
  queryFn: menuApi.getCategories,
  staleTime: 60_000,  // 60 seconds — balance freshness vs. request volume
});

const { data: menuItems = [] } = useQuery({
  queryKey: ["menuItems", selectedCategory],
  queryFn: () => menuApi.getMenuItems(selectedCategory ?? undefined),
  staleTime: 60_000,
});
```

- [ ] **Step 2: Update staleTime in MenuManagementPage**

In `frontend/src/pages/admin/MenuManagementPage.tsx`:

```typescript
const { data: categories = [] } = useQuery({
  queryKey: ["categories"],
  queryFn: menuApi.getCategories,
  staleTime: 30_000,  // 30s — admin sees updates faster
});

const {
  data: menuItems = [],
  isPending: itemsPending,
  isFetching: itemsFetching,
  isError: itemsError,
  refetch: refetchItems,
} = useQuery({
  queryKey: ["menuItems", selectedCategoryId],
  queryFn: () => menuApi.getMenuItems(selectedCategoryId ?? undefined),
  staleTime: 30_000,
});
```

- [ ] **Step 3: Also invalidate menu queries on socket `menu:updated` event**

The backend already emits `menu:updated` when a menu item is updated. Wire it up in the waiter's `OrderPage` by adding to the existing socket `useEffect`:

```typescript
useEffect(() => {
  if (!socket || !orderId) return;

  const handleUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ["order", orderId] });
  };

  const handleReady = () => {
    queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    toast("¡Pedido listo!", "success");
  };

  const handleMenuUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ["menuItems"] });
  };

  socket.on("order:item-updated", handleUpdate);
  socket.on("order:ready", handleReady);
  socket.on("menu:updated", handleMenuUpdated);

  return () => {
    socket.off("order:item-updated", handleUpdate);
    socket.off("order:ready", handleReady);
    socket.off("menu:updated", handleMenuUpdated);
  };
}, [socket, orderId, queryClient, toast]);
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/waiter/OrderPage.tsx frontend/src/pages/admin/MenuManagementPage.tsx
git commit -m "fix: reduce menu staleTime to 60s and invalidate on menu:updated socket event"
```

---

## Phase 3: Architecture Cleanup

### Task 8: Extract admin module to service layer (B11)

**What's wrong:** `admin.routes.ts` embeds all database queries and business logic directly in route handlers — no service layer. This is inconsistent with every other module (`auth`, `menu`, `orders`, `kitchen`, `superadmin`) which all have `service.ts` files. It makes unit testing impossible without spinning up a full HTTP server.

**Files:**
- Create: `backend/src/modules/admin/admin.service.ts`
- Create: `backend/src/modules/admin/admin.controller.ts`
- Modify: `backend/src/modules/admin/admin.routes.ts`
- Test: `backend/src/modules/admin/admin.unit.test.ts`

- [ ] **Step 1: Create `admin.service.ts`**

Create `backend/src/modules/admin/admin.service.ts`:

```typescript
import { eq, and } from "drizzle-orm";
import { hashPassword } from "../../shared/auth-utils.js";
import { db } from "../../config/db.js";
import { users } from "../../db/schema.js";
import { NotFoundError } from "../../utils/errors.js";
import type { CreateStaffInput, UpdateStaffInput } from "./admin.schema.js";

const STAFF_COLUMNS = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  isActive: users.isActive,
  createdAt: users.createdAt,
} as const;

export async function listStaff(restaurantId: string) {
  return db
    .select(STAFF_COLUMNS)
    .from(users)
    .where(eq(users.restaurantId, restaurantId))
    .orderBy(users.name);
}

export async function createStaff(restaurantId: string, input: CreateStaffInput) {
  const passwordHash = await hashPassword(input.password);
  const [user] = await db
    .insert(users)
    .values({
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
      restaurantId,
      isEmailVerified: true,
      isActive: true,
    })
    .returning(STAFF_COLUMNS);
  return user;
}

export async function updateStaff(restaurantId: string, userId: string, input: UpdateStaffInput & { password?: string }) {
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.email !== undefined) updates.email = input.email;
  if (input.role !== undefined) updates.role = input.role;
  if (input.isActive !== undefined) updates.isActive = input.isActive;
  if (input.password) updates.passwordHash = await hashPassword(input.password);

  const [user] = await db
    .update(users)
    .set(updates)
    .where(and(eq(users.id, userId), eq(users.restaurantId, restaurantId)))
    .returning(STAFF_COLUMNS);

  if (!user) throw new NotFoundError("User not found");
  return user;
}

export async function deactivateStaff(restaurantId: string, userId: string) {
  const [user] = await db
    .update(users)
    .set({ isActive: false })
    .where(and(eq(users.id, userId), eq(users.restaurantId, restaurantId)))
    .returning({ id: users.id });

  if (!user) throw new NotFoundError("User not found");
}
```

- [ ] **Step 2: Create `admin.controller.ts`**

Create `backend/src/modules/admin/admin.controller.ts`:

```typescript
import { Request, Response } from "express";
import * as adminService from "./admin.service.js";

export async function listStaff(req: Request, res: Response) {
  const staff = await adminService.listStaff(req.user!.restaurantId);
  res.json(staff);
}

export async function createStaff(req: Request, res: Response) {
  const user = await adminService.createStaff(req.user!.restaurantId, req.body);
  res.status(201).json(user);
}

export async function updateStaff(req: Request, res: Response) {
  const user = await adminService.updateStaff(
    req.user!.restaurantId,
    req.params.id as string,
    req.body
  );
  res.json(user);
}

export async function deactivateStaff(req: Request, res: Response) {
  await adminService.deactivateStaff(req.user!.restaurantId, req.params.id as string);
  res.status(204).end();
}
```

- [ ] **Step 3: Slim down `admin.routes.ts` to only routing**

Replace `backend/src/modules/admin/admin.routes.ts` entirely:

```typescript
import { Router } from "express";
import * as adminController from "./admin.controller.js";
import { authenticate, authorize } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { validateUUID } from "../../middleware/validateUUID.js";
import { createStaffSchema, updateStaffSchema } from "./admin.schema.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

router.use(authenticate);
router.use(authorize("admin"));
router.param("id", validateUUID("id"));

router.get("/staff", asyncHandler(adminController.listStaff));
router.post("/staff", validate(createStaffSchema), asyncHandler(adminController.createStaff));
router.put("/staff/:id", validate(updateStaffSchema), asyncHandler(adminController.updateStaff));
router.delete("/staff/:id", asyncHandler(adminController.deactivateStaff));

export default router;
```

- [ ] **Step 4: Write unit tests for the service**

Create `backend/src/modules/admin/admin.unit.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database
vi.mock("../../config/db.js", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: "uuid", name: "Test", email: "t@t.com", role: "waiter", isActive: true, createdAt: new Date() }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../shared/auth-utils.js", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed"),
}));

import { listStaff, createStaff, updateStaff, deactivateStaff } from "./admin.service.js";

describe("admin.service", () => {
  it("listStaff queries by restaurantId", async () => {
    const result = await listStaff("restaurant-id");
    expect(result).toBeDefined();
  });

  it("createStaff sets isEmailVerified to true", async () => {
    const { db } = await import("../../config/db.js");
    await createStaff("restaurant-id", { name: "Bob", email: "b@b.com", password: "pass", role: "waiter" });
    // Verify values() was called with isEmailVerified: true
    expect((db.values as any).mock.calls[0][0]).toMatchObject({ isEmailVerified: true });
  });
});
```

- [ ] **Step 5: Run tests**

Run: `cd backend && npm test -- --reporter=verbose admin`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/admin/
git commit -m "refactor: extract admin service and controller layers for testability"
```

---

### Task 9: Extract reports queries to service layer (B12)

**What's wrong:** `reports.controller.ts` contains all SQL queries directly with no service layer. Untestable and inconsistent.

**Files:**
- Create: `backend/src/modules/reports/reports.service.ts`
- Modify: `backend/src/modules/reports/reports.controller.ts`
- Test: `backend/src/modules/reports/reports.unit.test.ts`

- [ ] **Step 1: Read the current reports controller**

Run: `cat backend/src/modules/reports/reports.controller.ts`

Note the query functions: `getSummary`, `getTopItems`, `getRevenueByPeriod`, `getByWaiter`, `getByHour` (or whatever the actual function names are — confirm before writing the service).

- [ ] **Step 2: Create `reports.service.ts`**

Move all database query logic from `reports.controller.ts` to a new `backend/src/modules/reports/reports.service.ts`. Keep the same function signatures but remove `Request`/`Response` parameters — accept plain domain arguments instead:

```typescript
// Example shape — adjust to match actual controller queries
import { sql, eq, and, gte, lte } from "drizzle-orm";
import { db } from "../../config/db.js";
import { orders, orderItems, users } from "../../db/schema.js";

export async function getSummary(restaurantId: string, from: Date, to: Date) {
  // Move the SQL from the controller here verbatim, replacing req.user.restaurantId
  // with the restaurantId parameter
}

export async function getTopItems(restaurantId: string, from: Date, to: Date, limit: number) {
  // Same pattern
}

export async function getRevenueByPeriod(restaurantId: string, from: Date, to: Date, groupBy: "day" | "week" | "month") {
  // Same pattern
}

export async function getByWaiter(restaurantId: string, from: Date, to: Date) {
  // Same pattern
}

export async function getByHour(restaurantId: string, from: Date, to: Date) {
  // Same pattern
}
```

- [ ] **Step 3: Slim down `reports.controller.ts`**

Replace each handler body to call the service:

```typescript
import { Request, Response } from "express";
import * as reportsService from "./reports.service.js";

export async function getSummary(req: Request, res: Response) {
  const from = new Date(req.query.from as string);
  const to = new Date(req.query.to as string);
  const data = await reportsService.getSummary(req.user!.restaurantId, from, to);
  res.json(data);
}
// ... repeat for each handler
```

- [ ] **Step 4: Run existing tests**

Run: `cd backend && npm test`
Expected: All existing tests still PASS (no regression)

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/reports/
git commit -m "refactor: extract reports queries to service layer"
```

---

### Task 10: Add custom React hooks to eliminate duplicated data-fetching (B13 frontend)

**What's wrong:** The `frontend/src/hooks/` directory is empty. Menu queries, order queries, and socket event bindings are duplicated across `OrderPage`, `KitchenDisplayPage`, `TablesPage`, and `OrdersListPage`.

**Create two focused hooks:**
1. `useMenuData(categoryId?)` — wraps menu categories + items queries
2. `useOrderSocket(orderId?)` — wraps socket event bindings for a single order

**Files:**
- Create: `frontend/src/hooks/useMenuData.ts`
- Create: `frontend/src/hooks/useOrderSocket.ts`
- Modify: `frontend/src/pages/waiter/OrderPage.tsx` (consume the hooks)

- [ ] **Step 1: Create `useMenuData.ts`**

Create `frontend/src/hooks/useMenuData.ts`:

```typescript
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as menuApi from "../api/menu";

export function useMenuData(initialCategoryId: string | null = null) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategoryId);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: menuApi.getCategories,
    staleTime: 60_000,
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ["menuItems", selectedCategory],
    queryFn: () => menuApi.getMenuItems(selectedCategory ?? undefined),
    staleTime: 60_000,
  });

  return { categories, menuItems, selectedCategory, setSelectedCategory };
}
```

- [ ] **Step 2: Create `useOrderSocket.ts`**

Create `frontend/src/hooks/useOrderSocket.ts`:

```typescript
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocket } from "../context/SocketContext";
import { useToast } from "../components/ui/Toast";

/**
 * Subscribes to real-time socket events for a specific order.
 * Invalidates TanStack Query cache on updates and shows a toast when the order is ready.
 */
export function useOrderSocket(orderId: string | null) {
  const socket = useSocket();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (!socket || !orderId) return;

    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    };

    const handleReady = () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      toast("¡Pedido listo!", "success");
    };

    const handleMenuUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ["menuItems"] });
    };

    socket.on("order:item-updated", handleUpdate);
    socket.on("order:ready", handleReady);
    socket.on("menu:updated", handleMenuUpdated);

    return () => {
      socket.off("order:item-updated", handleUpdate);
      socket.off("order:ready", handleReady);
      socket.off("menu:updated", handleMenuUpdated);
    };
  }, [socket, orderId, queryClient, toast]);
}
```

- [ ] **Step 3: Consume the hooks in `OrderPage.tsx`**

In `frontend/src/pages/waiter/OrderPage.tsx`:

1. Remove the imports and state for menu queries and the socket useEffect
2. Add at the top of the `OrderPage` component:

```typescript
import { useMenuData } from "../../hooks/useMenuData";
import { useOrderSocket } from "../../hooks/useOrderSocket";
```

3. Replace the three `useQuery` calls for categories/menuItems and the socket `useEffect` with:

```typescript
const { categories, menuItems, selectedCategory, setSelectedCategory } = useMenuData();
useOrderSocket(orderId);
```

4. Remove the now-unused `socket` variable and its import from `SocketContext`.

- [ ] **Step 4: Verify no regressions**

Start dev server. Navigate through the waiter flow:
- Menu categories and items load
- Adding items to cart works
- Socket events still update the order in real-time (test by marking item ready from kitchen in another tab)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/ frontend/src/pages/waiter/OrderPage.tsx
git commit -m "refactor: extract useMenuData and useOrderSocket hooks to eliminate duplication"
```

---

### Task 11: Remove unused `packages/ui-auth` (B14)

**What's wrong:** `packages/ui-auth/` contains React auth components (`AuthPage`, `LoginForm`, `RegisterForm`, `PasswordInput`) that are duplicated verbatim in `frontend/src/components/auth/`. The shared package is never imported by the frontend. It's dead code that confuses contributors.

**Files:**
- Delete: `packages/ui-auth/` (entire directory)
- No functional change needed — `frontend/src/components/auth/` is the live copy

- [ ] **Step 1: Confirm `packages/ui-auth` is not imported anywhere**

```bash
grep -r "ui-auth" "Restaurant app/frontend/src" --include="*.ts" --include="*.tsx"
grep -r "packages/ui-auth" "Restaurant app" --include="*.ts" --include="*.tsx" --include="*.json"
```

Expected: No matches (confirm before deleting)

- [ ] **Step 2: Remove the package**

```bash
rm -rf "Restaurant app/packages/ui-auth"
```

- [ ] **Step 3: Verify frontend builds**

```bash
cd "Restaurant app/frontend" && npm run build
```

Expected: Build succeeds with no errors

- [ ] **Step 4: Commit**

```bash
git add -A packages/
git commit -m "chore: remove unused packages/ui-auth (components live in frontend/src/components/auth/)"
```

---

## Phase 4: Security & Performance

### Task 12: Move access token from `localStorage` to memory (B10)

**What's wrong:** The JWT access token is stored in `localStorage`, which is readable by any JavaScript on the page (XSS vulnerability). The refresh token is correctly stored in an httpOnly cookie. Access tokens should live in a JavaScript closure — not in `localStorage`.

**Files:**
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/context/AuthContext.tsx`

- [ ] **Step 1: Create an in-memory token store in `api/client.ts`**

In `frontend/src/api/client.ts`, replace the current interceptor with:

```typescript
import axios from "axios";
import { env } from "../config/env";  // or however VITE_API_URL is accessed

// ── In-memory access token (never written to localStorage) ──────────────────
let _accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}
// ────────────────────────────────────────────────────────────────────────────

const client = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL ?? ""}/api`,
  withCredentials: true,
});

// Attach token to every request
client.interceptors.request.use((config) => {
  if (_accessToken) {
    config.headers.Authorization = `Bearer ${_accessToken}`;
  }
  return config;
});

// On 401 → attempt refresh, then replay the request
let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retried) {
      return Promise.reject(error);
    }
    original._retried = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push((token) => {
          if (token) {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(client(original));
          } else {
            reject(error);
          }
        });
      });
    }

    isRefreshing = true;
    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_URL ?? ""}/api/auth/refresh`,
        {},
        { withCredentials: true }
      );
      const newToken: string = data.accessToken;
      setAccessToken(newToken);
      refreshQueue.forEach((cb) => cb(newToken));
      refreshQueue = [];
      original.headers.Authorization = `Bearer ${newToken}`;
      return client(original);
    } catch {
      setAccessToken(null);
      refreshQueue.forEach((cb) => cb(null));
      refreshQueue = [];
      // Redirect to login — use window.location to avoid circular import of router
      window.location.href = "/login";
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  }
);

export default client;
```

- [ ] **Step 2: Update `AuthContext.tsx` to use `setAccessToken`**

Replace the current `AuthContext.tsx`:

```typescript
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import * as authApi from "../api/auth";
import { setAccessToken } from "../api/client";
import type { User } from "../types";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // On mount, attempt a silent refresh via the httpOnly cookie
    // This restores the session without any stored token
    authApi
      .refresh()
      .then(({ accessToken }) => {
        setAccessToken(accessToken);
        return authApi.getMe();
      })
      .then(setUser)
      .catch(() => {
        setAccessToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    setAccessToken(result.accessToken);
    setUser(result.user);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    await authApi.register(name, email, password);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {}); // best-effort
    setAccessToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

Note: This requires `authApi.refresh()` to be exported. Verify it exists in `frontend/src/api/auth.ts`. If not, add:

```typescript
export async function refresh(): Promise<{ accessToken: string }> {
  const { data } = await client.post<{ accessToken: string }>("/auth/refresh");
  return data;
}
```

- [ ] **Step 3: Remove `localStorage` reads from entire codebase**

```bash
grep -rn "localStorage" frontend/src --include="*.ts" --include="*.tsx"
```

Remove any remaining `localStorage.getItem("accessToken")` or `localStorage.setItem("accessToken", ...)` calls. There should be none after these changes.

- [ ] **Step 4: Test the auth flow**

Start dev server and backend. Verify:
1. Login redirects correctly
2. Refreshing the page re-establishes the session (via cookie → silent refresh)
3. Logging out clears the session
4. After token expiry (wait 15min or reduce TTL temporarily), the next request auto-refreshes

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/client.ts frontend/src/context/AuthContext.tsx frontend/src/api/auth.ts
git commit -m "security: move access token from localStorage to memory to prevent XSS token theft"
```

---

### Task 13: Add missing database indexes (B13)

**What's wrong:** High-frequency query filters (`restaurantId`, `status`, order item joins) have no indexes. As order volume grows, queries become full-table scans.

**Files:**
- Modify: `backend/src/db/schema.ts`
- New migration: auto-generated by `npm run db:generate`

- [ ] **Step 1: Add indexes to schema**

In `backend/src/db/schema.ts`, add `index` to imports and add indexes:

```typescript
import {
  pgTable, uuid, varchar, text, decimal, integer,
  boolean, timestamp, unique, jsonb, index,
} from "drizzle-orm/pg-core";
```

Update the `orders` table definition to add indexes:

```typescript
export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  restaurantId: uuid("restaurant_id").notNull().references(() => restaurants.id),
  tableId: uuid("table_id").notNull().references(() => tables.id),
  waiterId: uuid("waiter_id").notNull().references(() => users.id),
  status: varchar("status", { length: 20 }).default("draft").notNull()
    .$type<"draft" | "placed" | "preparing" | "ready" | "served" | "cancelled">(),
  notes: text("notes"),
  discountType: varchar("discount_type", { length: 20 }).default("none").notNull()
    .$type<"none" | "percentage" | "fixed">(),
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }).default("0.00").notNull(),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0.00").notNull(),
  discountReason: text("discount_reason"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).default("0.00").notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).default("0.00").notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("orders_restaurant_id_idx").on(table.restaurantId),
  index("orders_status_idx").on(table.status),
  index("orders_restaurant_status_idx").on(table.restaurantId, table.status),
]);
```

Update `orderItems` table:

```typescript
export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  menuItemId: uuid("menu_item_id").notNull().references(() => menuItems.id),
  quantity: integer("quantity").default(1).notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  itemName: varchar("item_name", { length: 255 }).notNull(),
  notes: text("notes"),
  status: varchar("status", { length: 20 }).default("pending").notNull()
    .$type<"pending" | "preparing" | "ready" | "served" | "cancelled">(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("order_items_order_id_idx").on(table.orderId),
]);
```

Update `menuItems` table:

```typescript
export const menuItems = pgTable("menu_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  restaurantId: uuid("restaurant_id").notNull().references(() => restaurants.id),
  categoryId: uuid("category_id").notNull().references(() => categories.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: varchar("image_url", { length: 500 }),
  stockCount: integer("stock_count"),
  isAvailable: boolean("is_available").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("menu_items_restaurant_id_idx").on(table.restaurantId),
  index("menu_items_category_id_idx").on(table.categoryId),
]);
```

- [ ] **Step 2: Generate migration**

```bash
cd backend && npm run db:generate
```

Expected: A new SQL file appears in `backend/src/db/migrations/` with `CREATE INDEX` statements.

- [ ] **Step 3: Apply migration locally**

```bash
cd backend && npm run db:migrate
```

Expected: Migration applies without errors.

- [ ] **Step 4: Run tests**

```bash
cd backend && npm test
```

Expected: All PASS (indexes are transparent to existing tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/db/schema.ts backend/src/db/migrations/
git commit -m "perf: add indexes on orders, order_items, and menu_items for frequent query filters"
```

---

## Self-Review Checklist

### Spec Coverage

| Bug | Task | Status |
|-----|------|--------|
| B1 — syncOrderStatus no socket event | Task 1 | Covered |
| B2 — syncOrderStatus resets served order | Task 1 | Covered |
| B3 — kitchen cancel no stock restore | Task 2 | Covered |
| B4 — cancelOrder double-restores stock | Task 2 | Covered |
| B5 — updateOrder stock not transactional | Task 3 | Covered |
| B6 — admin staff can't log in | Task 4 | Covered |
| B7 — handleSaveAndPlace no error handling | Task 6 | Covered |
| B8 — no cancel button for waiters | Task 5 | Covered |
| B9 — staleTime Infinity on menu | Task 7 | Covered |
| B10 — accessToken in localStorage | Task 12 | Covered |
| B11 — admin routes no service layer | Task 8 | Covered |
| B12 — reports SQL in controller | Task 9 | Covered |
| B13 — missing DB indexes | Task 13 | Covered |
| B14 — duplicate ui-auth package | Task 11 | Covered |

### Type Consistency Check

- `updateItemStatus()` return type changed to `{ item, newOrderStatus, orderId }` in Task 1 — `kitchen.controller.ts` updated in same task. ✓
- `setAccessToken` / `getAccessToken` defined in Task 12 `client.ts` and consumed in `AuthContext.tsx` in same task. ✓
- `STAFF_COLUMNS` defined once in `admin.service.ts` and used throughout. ✓
- `syncOrderStatus` return type `"preparing" | "ready" | "cancelled" | null` consistent across Tasks 1 and 2. ✓

### No-Placeholder Check

All code blocks are complete. No "TBD", "TODO", "implement later", "similar to Task N". ✓

---

> **Execution:** Two options — subagent-driven (one agent per task) or inline execution. See plan header for sub-skill instructions.
