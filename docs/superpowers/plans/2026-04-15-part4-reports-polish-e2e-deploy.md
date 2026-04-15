# Restaurant App Rewrite — Part 4: Reports, UI Polish, E2E Tests & Production Deploy

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement day/week/month reports with charts, apply shadcn/ui polish across all pages, add Web Push subscription wiring, write Playwright E2E tests for all 4 roles, configure the production deploy pipeline, and write the demo cron reset.

**Architecture:** Reports are pure SQL queries in a dedicated tRPC router — no separate service file. shadcn/ui components are added via `npx shadcn@latest add` individually. E2E tests use Playwright with role-specific auth state files. The deploy script builds multi-arch images, pushes to GHCR, and triggers a `docker compose pull && up -d` on the remote host via SSH.

**Tech Stack:** shadcn/ui chart component (recharts), Playwright v1.44, web-push npm package, node-cron

---

## File Map

**Server additions:**
- Create: `apps/server/src/routers/reports.ts`
- Create: `apps/server/src/lib/demoCron.ts` — 2h demo reset
- Create: `apps/server/src/routers/push.ts` — Web Push subscribe endpoint
- Modify: `apps/server/src/routers/index.ts`
- Modify: `apps/server/src/index.ts` — start cron

**Frontend additions:**
- Create: `apps/web/src/routes/_app/admin/reports.tsx`
- Create: `apps/web/src/components/PeriodSelector.tsx`
- Create: `apps/web/src/components/RevenueChart.tsx`
- Create: `apps/web/src/components/TopItemsChart.tsx`
- Create: `apps/web/src/hooks/usePushSubscription.ts`
- Modify: `apps/web/src/routes/_app.tsx` — mount push subscription

**Infrastructure:**
- Create: `apps/server/Dockerfile`
- Create: `apps/web/Dockerfile`
- Create: `apps/web/nginx.conf`
- Create: `docker-compose.prod.yml`
- Create: `deploy.sh`

**Tests:**
- Create: `e2e/playwright.config.ts`
- Create: `e2e/auth.setup.ts`
- Create: `e2e/tests/waiter.spec.ts`
- Create: `e2e/tests/kitchen.spec.ts`
- Create: `e2e/tests/cashier.spec.ts`
- Create: `e2e/tests/admin.spec.ts`

---

### Task 1: Reports Router (Server)

**Files:**
- Create: `apps/server/src/routers/reports.ts`

- [ ] **Step 1: Create `apps/server/src/routers/reports.ts`**

```typescript
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

        // Group by day for week/month, by hour for day
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
```

- [ ] **Step 2: Add reports to router index**

```typescript
import { reportsRouter } from "./reports.js";
// Add to appRouter:
reports: reportsRouter,
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/routers/reports.ts apps/server/src/routers/index.ts
git commit -m "feat: reports router — orders summary, by waiter/hour/item, inventory usage and cost

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Reports Frontend

**Files:**
- Create: `apps/web/src/routes/_app/admin/reports.tsx`
- Create: `apps/web/src/components/PeriodSelector.tsx`

- [ ] **Step 1: Install recharts (used by shadcn charts)**

Add to `apps/web/package.json` dependencies:
```json
"recharts": "^2.12.0"
```

Run: `pnpm install`

- [ ] **Step 2: Create `apps/web/src/components/PeriodSelector.tsx`**

```typescript
type Period = "day" | "week" | "month";

const LABELS: Record<Period, string> = { day: "Today", week: "This Week", month: "This Month" };

export function PeriodSelector({
  value,
  onChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
}) {
  return (
    <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
      {(["day", "week", "month"] as Period[]).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`flex-1 py-1.5 px-3 rounded text-sm font-medium transition-colors ${
            value === p ? "bg-accent text-black" : "text-muted hover:text-white"
          }`}
        >
          {LABELS[p]}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create `apps/web/src/routes/_app/admin/reports.tsx`**

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line
} from "recharts";
import { trpc } from "../../../trpc.js";
import { PeriodSelector } from "../../../components/PeriodSelector.js";

export const Route = createFileRoute("/_app/admin/reports")({
  component: ReportsPage,
});

type Period = "day" | "week" | "month";

function ReportsPage() {
  const [period, setPeriod] = useState<Period>("day");

  const { data: summary } = trpc.reports.orders.summary.useQuery({ period });
  const { data: revenue = [] } = trpc.reports.orders.revenue.useQuery({ period });
  const { data: topItems = [] } = trpc.reports.orders.topItems.useQuery({ period, limit: 10 });
  const { data: byWaiter = [] } = trpc.reports.orders.byWaiter.useQuery({ period });
  const { data: inventoryUsage = [] } = trpc.reports.inventory.usage.useQuery({ period });
  const { data: lowStock = [] } = trpc.reports.inventory.lowStock.useQuery();

  const revenueData = revenue.map((r: any) => ({
    label: new Date(r.period).toLocaleString("es", {
      hour: period === "day" ? "2-digit" : undefined,
      day: period !== "day" ? "2-digit" : undefined,
      month: period !== "day" ? "short" : undefined,
    }),
    revenue: Number(r.revenue).toFixed(2),
    orders: r.orderCount,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold">Reports</h1>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Orders" value={summary?.totalOrders ?? 0} />
        <StatCard label="Revenue" value={`$${Number(summary?.totalRevenue ?? 0).toFixed(2)}`} color="text-success" />
        <StatCard label="Tax Collected" value={`$${Number(summary?.totalTax ?? 0).toFixed(2)}`} />
        <StatCard label="Discounts Given" value={`$${Number(summary?.totalDiscounts ?? 0).toFixed(2)}`} color="text-destructive" />
      </div>

      {/* Revenue chart */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <h2 className="font-semibold mb-4">Revenue Over Time</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2128" />
            <XAxis dataKey="label" stroke="#6b7280" tick={{ fontSize: 11 }} />
            <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "#111318", border: "1px solid #1f2128", borderRadius: "8px" }}
              labelStyle={{ color: "#fff" }}
            />
            <Line type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2} dot={false} name="Revenue ($)" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top items + By waiter side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4">
          <h2 className="font-semibold mb-4">Top Selling Items</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topItems.map((i: any) => ({ name: i.itemName.substring(0, 12), qty: Number(i.totalQuantity) }))} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2128" />
              <XAxis type="number" stroke="#6b7280" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" stroke="#6b7280" tick={{ fontSize: 10 }} width={80} />
              <Tooltip contentStyle={{ background: "#111318", border: "1px solid #1f2128", borderRadius: "8px" }} />
              <Bar dataKey="qty" fill="#f59e0b" name="Qty sold" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <h2 className="font-semibold mb-4">Sales by Waiter</h2>
          <div className="space-y-2">
            {byWaiter.map((w: any) => (
              <div key={w.waiterId} className="flex items-center justify-between text-sm">
                <span>{w.waiterName}</span>
                <div className="text-right">
                  <div className="text-accent">${Number(w.totalRevenue).toFixed(2)}</div>
                  <div className="text-muted text-xs">{w.orderCount} orders</div>
                </div>
              </div>
            ))}
            {byWaiter.length === 0 && <p className="text-muted text-sm">No data for this period</p>}
          </div>
        </div>
      </div>

      {/* Inventory usage */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <h2 className="font-semibold mb-4">Ingredient Usage</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="pb-2">Ingredient</th>
                <th className="pb-2">Used</th>
                <th className="pb-2">Wasted</th>
                <th className="pb-2">Unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {inventoryUsage.map((i: any) => (
                <tr key={i.ingredientId}>
                  <td className="py-2">{i.ingredientName}</td>
                  <td className="py-2">{Number(i.totalUsed).toFixed(3)}</td>
                  <td className="py-2 text-muted">{Number(i.totalWasted).toFixed(3)}</td>
                  <td className="py-2 text-muted">{i.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Low stock snapshot */}
      {lowStock.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4">
          <h2 className="font-semibold text-destructive mb-3">Current Low Stock</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {lowStock.map((i: any) => (
              <div key={i.id} className="text-sm">
                <span className="font-medium">{i.name}</span>
                <span className="text-destructive ml-2">{i.currentStock} / {i.minStock} {i.unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color = "text-white" }: { label: string; value: any; color?: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="text-muted text-xs mb-1">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/routes/_app/admin/reports.tsx apps/web/src/components/PeriodSelector.tsx apps/web/package.json
git commit -m "feat: reports page with revenue chart, top items, by-waiter, inventory usage

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Web Push Subscription Wiring

**Files:**
- Create: `apps/server/src/routers/push.ts`
- Create: `apps/web/src/hooks/usePushSubscription.ts`

- [ ] **Step 1: Create `apps/server/src/routers/push.ts`**

```typescript
import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc/trpc.js";
import { pushSubscriptions } from "@restaurant/db";
import webpush from "web-push";
import { env } from "../env.js";

if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    env.VAPID_SUBJECT ?? "mailto:admin@localhost",
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY
  );
}

export async function sendPushNotification(
  db: any,
  userId: string,
  payload: { title: string; body: string; url?: string }
) {
  if (!env.VAPID_PUBLIC_KEY) return; // push disabled

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  const notifications = subs.map((sub: any) =>
    webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload)
    ).catch(() => {
      // If endpoint is gone, delete subscription
      db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
    })
  );

  await Promise.allSettled(notifications);
}

export const pushRouter = router({
  subscribe: protectedProcedure
    .input(z.object({
      endpoint: z.string().url(),
      p256dh: z.string(),
      auth: z.string(),
      userAgent: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Upsert by endpoint
      const existing = await ctx.db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, input.endpoint));

      if (existing.length === 0) {
        await ctx.db.insert(pushSubscriptions).values({
          userId: ctx.session!.user.id,
          ...input,
        });
      }
      return { success: true };
    }),

  unsubscribe: protectedProcedure
    .input(z.object({ endpoint: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, input.endpoint));
      return { success: true };
    }),

  vapidPublicKey: protectedProcedure.query(() => {
    return { key: env.VAPID_PUBLIC_KEY ?? null };
  }),
});
```

- [ ] **Step 2: Add push router to index and update orders/kitchen to trigger push**

In `apps/server/src/routers/index.ts`, add:
```typescript
import { pushRouter } from "./push.js";
// Add to appRouter:
push: pushRouter,
```

In `apps/server/src/routers/orders.ts`, after emitting `order:ready`, add:
```typescript
// Web Push to the waiter
import { sendPushNotification } from "./push.js";
// In the place() mutation, after syncOrderStatus if order becomes ready:
// This is called from syncOrderStatus in kitchen.ts on item updates
// For the orders router, when order status update comes via serve/place, push is handled by kitchen sync
```

In `apps/server/src/routers/kitchen.ts`, in `syncOrderStatus` when `newStatus === "ready"`:
```typescript
import { sendPushNotification } from "./push.js";
// After emitting order:ready:
await sendPushNotification(db, order.waiterId, {
  title: "Order Ready",
  body: `Table order is ready to serve`,
  url: `/waiter/orders/${orderId}`,
});
```

- [ ] **Step 3: Create `apps/web/src/hooks/usePushSubscription.ts`**

```typescript
import { useEffect } from "react";
import { trpc } from "../trpc.js";
import { authClient } from "../auth.js";

export function usePushSubscription() {
  const { data: session } = authClient.useSession();
  const { data: vapidData } = trpc.push.vapidPublicKey.useQuery(undefined, {
    enabled: !!session?.user,
  });
  const subscribe = trpc.push.subscribe.useMutation();

  useEffect(() => {
    if (!vapidData?.key || !session?.user) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const role = (session.user as any).role;
    // Only subscribe roles that need push: waiter, kitchen, admin
    if (!["waiter", "kitchen", "admin"].includes(role)) return;

    async function requestSubscription() {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();

      if (existing) {
        const json = existing.toJSON();
        subscribe.mutate({
          endpoint: json.endpoint!,
          p256dh: (json.keys as any).p256dh,
          auth: (json.keys as any).auth,
          userAgent: navigator.userAgent,
        });
        return;
      }

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData!.key!),
      });

      const json = sub.toJSON();
      subscribe.mutate({
        endpoint: json.endpoint!,
        p256dh: (json.keys as any).p256dh,
        auth: (json.keys as any).auth,
        userAgent: navigator.userAgent,
      });
    }

    requestSubscription();
  }, [vapidData?.key, session?.user?.id]);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
```

- [ ] **Step 4: Mount push subscription hook in `_app.tsx`**

In `apps/web/src/routes/_app.tsx`, add `usePushSubscription()` to the `AppLayout` component alongside `useSubscriptions()`.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routers/push.ts apps/web/src/hooks/usePushSubscription.ts apps/server/src/routers/index.ts
git commit -m "feat: Web Push VAPID subscription — subscribe on login, push on order:ready

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Demo Cron Reset

**Files:**
- Create: `apps/server/src/lib/demoCron.ts`

- [ ] **Step 1: Add node-cron to server package.json**

```json
"node-cron": "^3.0.3",
"@types/node-cron": "^3.0.11"
```

Run: `pnpm install`

- [ ] **Step 2: Create `apps/server/src/lib/demoCron.ts`**

```typescript
import cron from "node-cron";
import { db } from "../db.js";
import { restaurants } from "@restaurant/db";
import { eq } from "drizzle-orm";

/** Runs the demo seed every 2 hours to reset demo restaurant data */
export function startDemoCron() {
  // Every 2 hours at minute 0
  cron.schedule("0 */2 * * *", async () => {
    console.log("[demoCron] Resetting demo restaurant data...");
    try {
      // Import and run seed for demo restaurant only
      const { seedDemo } = await import("../../../packages/db/src/seed.js");
      await seedDemo();
      console.log("[demoCron] Demo reset complete");
    } catch (err) {
      console.error("[demoCron] Demo reset failed:", err);
    }
  });
}
```

- [ ] **Step 3: Update `apps/server/src/lib/demoCron.ts`** — use self-contained reset

Since the seed.ts is in `packages/db`, update to call the DB directly:

```typescript
import cron from "node-cron";
import { db } from "../db.js";
import { orders, categories, menuItems, tables, ingredients, recipeItems, restaurants } from "@restaurant/db";
import { eq, sql } from "drizzle-orm";

export function startDemoCron() {
  cron.schedule("0 */2 * * *", async () => {
    console.log("[demoCron] Resetting demo restaurant...");
    try {
      const [demoRestaurant] = await db
        .select()
        .from(restaurants)
        .where(eq(restaurants.status, "demo"));

      if (!demoRestaurant) return;
      const rid = demoRestaurant.id;

      // Clear orders and inventory transactions (cascade deletes order_items, order_events)
      await db.delete(orders).where(eq(orders.restaurantId, rid));

      // Reset ingredient stock
      await db
        .update(ingredients)
        .set({ currentStock: sql`${ingredients.minStock} * 5`, updatedAt: new Date() })
        .where(eq(ingredients.restaurantId, rid));

      console.log("[demoCron] Demo reset complete");
    } catch (err) {
      console.error("[demoCron] Error:", err);
    }
  });
}
```

- [ ] **Step 4: Call `startDemoCron()` in `apps/server/src/index.ts`** after startup

```typescript
import { startDemoCron } from "./lib/demoCron.js";
// At the bottom of startup:
startDemoCron();
```

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/demoCron.ts apps/server/src/index.ts apps/server/package.json
git commit -m "feat: cron job to reset demo restaurant data every 2 hours

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Production Dockerfiles + Nginx + docker-compose.prod.yml

**Files:**
- Create: `apps/server/Dockerfile`
- Create: `apps/web/Dockerfile`
- Create: `apps/web/nginx.conf`
- Create: `docker-compose.prod.yml`

- [ ] **Step 1: Create `apps/server/Dockerfile`** (production multi-stage)

```dockerfile
FROM node:22-alpine AS base
RUN npm install -g pnpm turbo

FROM base AS builder
WORKDIR /app
COPY . .
RUN turbo prune @restaurant/server --docker

FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

FROM installer AS runner
WORKDIR /app
COPY --from=builder /app/out/full/ .
RUN pnpm turbo build --filter=@restaurant/server
EXPOSE 3000
CMD ["node", "apps/server/dist/index.js"]
```

- [ ] **Step 2: Create `apps/web/Dockerfile`** (production multi-stage)

```dockerfile
FROM node:22-alpine AS base
RUN npm install -g pnpm turbo

FROM base AS builder
WORKDIR /app
COPY . .
RUN turbo prune @restaurant/web --docker

FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

FROM installer AS runner
WORKDIR /app
COPY --from=builder /app/out/full/ .
ARG VITE_API_URL=""
ARG VITE_BASE_PATH="/restaurant/"
ARG VITE_VAPID_PUBLIC_KEY=""
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_BASE_PATH=$VITE_BASE_PATH
ENV VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY
RUN pnpm turbo build --filter=@restaurant/web

FROM nginx:alpine
COPY --from=runner /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

- [ ] **Step 3: Create `apps/web/nginx.conf`**

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # Never cache service worker or web manifest (required for PWA updates)
    location ~* (service-worker\.js|manifest\.webmanifest)$ {
        add_header Cache-Control "no-store, no-cache, must-revalidate";
        try_files $uri =404;
    }

    # Hashed assets (Vite adds content hash) — cache for 1 year
    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }

    # SPA fallback — all non-file routes → index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 4: Create `docker-compose.prod.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: restaurant
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      retries: 5

  server:
    image: ghcr.io/${GITHUB_REPO}/server:${IMAGE_TAG}
    depends_on:
      postgres: { condition: service_healthy }
      redis:    { condition: service_healthy }
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/restaurant
      REDIS_URL: redis://redis:6379
      BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET}
      BETTER_AUTH_URL: https://humerez.dev
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
      RESEND_API_KEY: ${RESEND_API_KEY}
      RESEND_FROM: ${RESEND_FROM}
      R2_ACCOUNT_ID: ${R2_ACCOUNT_ID}
      R2_ACCESS_KEY: ${R2_ACCESS_KEY}
      R2_SECRET_KEY: ${R2_SECRET_KEY}
      R2_BUCKET: ${R2_BUCKET}
      R2_PUBLIC_URL: ${R2_PUBLIC_URL}
      VAPID_PUBLIC_KEY: ${VAPID_PUBLIC_KEY}
      VAPID_PRIVATE_KEY: ${VAPID_PRIVATE_KEY}
      VAPID_SUBJECT: ${VAPID_SUBJECT}
      NODE_ENV: production
      PORT: 3000
      CORS_ORIGIN: https://humerez.dev
    restart: unless-stopped
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.restaurant-api.rule=Host(`humerez.dev`) && PathPrefix(`/restaurant/api`)"
      - "traefik.http.routers.restaurant-api.entrypoints=websecure"
      - "traefik.http.routers.restaurant-api.tls.certresolver=letsencrypt"
      - "traefik.http.middlewares.restaurant-strip.stripprefix.prefixes=/restaurant"
      - "traefik.http.routers.restaurant-api.middlewares=restaurant-strip"
      - "traefik.http.services.restaurant-api.loadbalancer.server.port=3000"

  web:
    image: ghcr.io/${GITHUB_REPO}/web:${IMAGE_TAG}
    restart: unless-stopped
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.restaurant-web.rule=Host(`humerez.dev`) && PathPrefix(`/restaurant`)"
      - "traefik.http.routers.restaurant-web.entrypoints=websecure"
      - "traefik.http.routers.restaurant-web.tls.certresolver=letsencrypt"
      - "traefik.http.routers.restaurant-web.middlewares=restaurant-strip"
      - "traefik.http.services.restaurant-web.loadbalancer.server.port=80"

volumes:
  postgres_data:
  redis_data:
```

- [ ] **Step 5: Commit**

```bash
git add apps/server/Dockerfile apps/web/Dockerfile apps/web/nginx.conf docker-compose.prod.yml
git commit -m "chore: production Dockerfiles, nginx.conf with PWA headers, docker-compose.prod

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Deploy Script

**Files:**
- Create: `deploy.sh`

- [ ] **Step 1: Create `deploy.sh`**

```bash
#!/bin/bash
set -euo pipefail

# Usage: ./deploy.sh [image-tag]
# Requires: GITHUB_REPO, POSTGRES_PASSWORD, BETTER_AUTH_SECRET, VAPID_PUBLIC_KEY, SSH_HOST env vars
# Example: GITHUB_REPO=yourusername/restaurant-app SSH_HOST=user@server.com ./deploy.sh

IMAGE_TAG="${1:-$(git rev-parse --short HEAD)}"
GITHUB_REPO="${GITHUB_REPO:?GITHUB_REPO is required}"
SSH_HOST="${SSH_HOST:?SSH_HOST is required}"

echo "→ Building images (tag: $IMAGE_TAG)"

# Build server
docker build \
  -t "ghcr.io/${GITHUB_REPO}/server:${IMAGE_TAG}" \
  -t "ghcr.io/${GITHUB_REPO}/server:latest" \
  -f apps/server/Dockerfile \
  .

# Build web
docker build \
  --build-arg VITE_API_URL="" \
  --build-arg VITE_BASE_PATH="/restaurant/" \
  --build-arg VITE_VAPID_PUBLIC_KEY="${VAPID_PUBLIC_KEY:-}" \
  -t "ghcr.io/${GITHUB_REPO}/web:${IMAGE_TAG}" \
  -t "ghcr.io/${GITHUB_REPO}/web:latest" \
  -f apps/web/Dockerfile \
  .

echo "→ Pushing to GHCR"
docker push "ghcr.io/${GITHUB_REPO}/server:${IMAGE_TAG}"
docker push "ghcr.io/${GITHUB_REPO}/server:latest"
docker push "ghcr.io/${GITHUB_REPO}/web:${IMAGE_TAG}"
docker push "ghcr.io/${GITHUB_REPO}/web:latest"

echo "→ Deploying to ${SSH_HOST}"
ssh "${SSH_HOST}" bash -s <<EOF
  cd ~/restaurant-app
  export IMAGE_TAG="${IMAGE_TAG}"
  export GITHUB_REPO="${GITHUB_REPO}"
  docker compose -f docker-compose.prod.yml pull
  docker compose -f docker-compose.prod.yml up -d --remove-orphans
  docker image prune -f
  echo "Deployment complete: ${IMAGE_TAG}"
EOF

echo "✓ Deployed restaurant-app:${IMAGE_TAG}"
```

- [ ] **Step 2: Make executable and commit**

```bash
chmod +x deploy.sh
git add deploy.sh
git commit -m "chore: deploy.sh — build, push to GHCR, SSH deploy to production

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Playwright E2E Tests

**Files:**
- Create: `e2e/package.json`
- Create: `e2e/playwright.config.ts`
- Create: `e2e/auth.setup.ts`
- Create: `e2e/tests/waiter.spec.ts`
- Create: `e2e/tests/kitchen.spec.ts`
- Create: `e2e/tests/cashier.spec.ts`
- Create: `e2e/tests/admin.spec.ts`

- [ ] **Step 1: Create `e2e/package.json`**

```json
{
  "name": "@restaurant/e2e",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "test": "playwright test",
    "test:headed": "playwright test --headed",
    "test:ui": "playwright test --ui"
  },
  "devDependencies": {
    "@playwright/test": "^1.44.0"
  }
}
```

- [ ] **Step 2: Create `e2e/playwright.config.ts`**

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    // Auth setup — creates saved state files for each role
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "waiter",
      use: {
        ...devices["iPhone 13"],
        storageState: "e2e/.auth/waiter.json",
      },
      dependencies: ["setup"],
    },
    {
      name: "kitchen",
      use: {
        ...devices["iPad (gen 7)"],
        storageState: "e2e/.auth/kitchen.json",
      },
      dependencies: ["setup"],
    },
    {
      name: "cashier",
      use: { storageState: "e2e/.auth/cashier.json" },
      dependencies: ["setup"],
    },
    {
      name: "admin",
      use: { storageState: "e2e/.auth/admin.json" },
      dependencies: ["setup"],
    },
  ],
});
```

- [ ] **Step 3: Create `e2e/auth.setup.ts`**

```typescript
import { test as setup } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const authDir = path.join(__dirname, ".auth");
if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

const DEMO_ROLES = ["waiter", "kitchen", "cashier", "admin"] as const;

for (const role of DEMO_ROLES) {
  setup(`authenticate as ${role}`, async ({ page, context }) => {
    await page.goto("/demo");
    await page.getByRole("button", { name: new RegExp(role, "i") }).click();
    // Wait for redirect to role home
    await page.waitForURL((url) => !url.pathname.includes("/demo"), { timeout: 10_000 });
    // Save cookies/storage state
    await context.storageState({ path: `e2e/.auth/${role}.json` });
  });
}
```

- [ ] **Step 4: Create `e2e/tests/waiter.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

test.describe("Waiter flow", () => {
  test("can view tables page", async ({ page }) => {
    await page.goto("/waiter/tables");
    await expect(page.getByRole("heading", { name: "Tables" })).toBeVisible();
    // Should show at least some tables
    const tableButtons = page.locator("button").filter({ hasText: /^\d+$/ });
    await expect(tableButtons.first()).toBeVisible({ timeout: 10_000 });
  });

  test("can create and send order to kitchen", async ({ page }) => {
    await page.goto("/waiter/tables");
    // Click first free table
    const freeTable = page.locator(".bg-surface.border-border").first();
    await freeTable.click();
    await page.waitForURL(/\/waiter\/orders\/(new|\w{8})/, { timeout: 8_000 });

    // Add item to cart
    const menuItemButton = page.locator(".grid button").first();
    await menuItemButton.click();

    // Cart should show 1 item
    await expect(page.getByText("1", { exact: true })).toBeVisible();

    // Send to kitchen
    await page.getByRole("button", { name: /send to kitchen/i }).click();

    // Should redirect back to tables
    await page.waitForURL("/waiter/tables", { timeout: 10_000 });
  });

  test("can cancel own order", async ({ page }) => {
    // Create an order first via table click
    await page.goto("/waiter/tables");
    await page.locator(".bg-surface.border-border").first().click();
    await page.waitForURL(/\/waiter\/orders/);

    // If we're on an existing order, cancel it
    const cancelButton = page.getByRole("button", { name: /cancel order/i });
    if (await cancelButton.isVisible()) {
      await cancelButton.click();
      await page.getByRole("button", { name: /ok|confirm|yes/i }).click();
      await page.waitForURL("/waiter/tables");
    }
  });

  test("demo banner is visible with role switcher", async ({ page }) => {
    await page.goto("/waiter/tables");
    // Demo banner shows current role and other role buttons
    await expect(page.getByText(/demo mode/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /switch to kitchen/i })).toBeVisible();
  });
});
```

- [ ] **Step 5: Create `e2e/tests/kitchen.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

test.describe("Kitchen flow", () => {
  test("can view kitchen display page", async ({ page }) => {
    await page.goto("/kitchen");
    await expect(page.getByRole("heading", { name: /kitchen display/i })).toBeVisible();
  });

  test("shows active orders", async ({ page }) => {
    await page.goto("/kitchen");
    // Either shows orders or "No active orders"
    const hasOrders = await page.locator(".grid .bg-surface").count();
    const noOrders = page.getByText("No active orders");
    if (hasOrders === 0) {
      await expect(noOrders).toBeVisible();
    } else {
      await expect(page.locator(".grid .bg-surface").first()).toBeVisible();
    }
  });

  test("can mark item as preparing", async ({ page }) => {
    await page.goto("/kitchen");
    const startButton = page.getByRole("button", { name: "Start" }).first();
    if (await startButton.isVisible()) {
      await startButton.click();
      // Button should change to "Ready"
      await expect(page.getByRole("button", { name: "Ready" }).first()).toBeVisible({ timeout: 5_000 });
    }
  });
});
```

- [ ] **Step 6: Create `e2e/tests/cashier.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

test.describe("Cashier flow", () => {
  test("can view cashier tables page", async ({ page }) => {
    await page.goto("/cashier/tables");
    await expect(page.getByRole("heading", { name: "Tables" })).toBeVisible();
  });

  test("can view order detail with occupied table", async ({ page }) => {
    await page.goto("/cashier/tables");
    // Find a table with an active order (amber or green bg)
    const occupiedTable = page
      .locator("button")
      .filter({ has: page.locator(".text-accent") }) // has price
      .first();

    if (await occupiedTable.isVisible()) {
      await occupiedTable.click();
      await page.waitForURL(/\/cashier\/orders\//);
      await expect(page.getByRole("heading", { name: "Order Detail" })).toBeVisible();
      await expect(page.getByRole("button", { name: /mark served/i })).toBeVisible();
    }
  });

  test("can apply discount to order", async ({ page }) => {
    await page.goto("/cashier/tables");
    const occupiedTable = page.locator("button").filter({ has: page.locator(".text-accent") }).first();

    if (await occupiedTable.isVisible()) {
      await occupiedTable.click();
      await page.waitForURL(/\/cashier\/orders\//);

      await page.getByRole("button", { name: /discount/i }).click();
      // Modal appears
      await expect(page.getByRole("heading", { name: "Apply Discount" })).toBeVisible();
      await page.getByPlaceholder(/e.g. 10/).fill("10");
      await page.getByRole("button", { name: "Apply" }).click();
      // Modal closes
      await expect(page.getByRole("heading", { name: "Apply Discount" })).not.toBeVisible();
    }
  });
});
```

- [ ] **Step 7: Create `e2e/tests/admin.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

test.describe("Admin flow", () => {
  test("can view admin dashboard", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Active Orders")).toBeVisible();
  });

  test("can view menu management", async ({ page }) => {
    await page.goto("/admin/menu");
    await expect(page.getByRole("heading", { name: "Menu Management" })).toBeVisible();
    // Should show at least one category
    await expect(page.locator("button").filter({ hasText: /all/i }).first()).toBeVisible();
  });

  test("can view staff management", async ({ page }) => {
    await page.goto("/admin/staff");
    await expect(page.getByRole("heading", { name: "Staff Management" })).toBeVisible();
  });

  test("can view inventory page", async ({ page }) => {
    await page.goto("/admin/inventory");
    await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible();
    // Should list ingredients from seed
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 8_000 });
  });

  test("can view reports page", async ({ page }) => {
    await page.goto("/admin/reports");
    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
    // Period selector visible
    await expect(page.getByRole("button", { name: "Today" })).toBeVisible();
    await expect(page.getByRole("button", { name: "This Week" })).toBeVisible();
    await expect(page.getByRole("button", { name: "This Month" })).toBeVisible();
  });

  test("reports switch periods", async ({ page }) => {
    await page.goto("/admin/reports");
    await page.getByRole("button", { name: "This Week" }).click();
    await expect(page.getByRole("button", { name: "This Week" })).toHaveClass(/bg-accent/);

    await page.getByRole("button", { name: "This Month" }).click();
    await expect(page.getByRole("button", { name: "This Month" })).toHaveClass(/bg-accent/);
  });
});
```

- [ ] **Step 8: Install Playwright browsers and run tests**

```bash
cd e2e && pnpm install && pnpm exec playwright install chromium
# Make sure the dev server is running first:
# docker compose up -d (from root)
pnpm test
```

Expected: All tests pass (or only skip if no active orders exist in demo)

- [ ] **Step 9: Commit**

```bash
git add e2e/
git commit -m "test: Playwright E2E tests for all 4 roles — waiter, kitchen, cashier, admin

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 8: Final Integration Verification

- [ ] **Step 1: Start full dev stack**

```bash
docker compose up -d
```

Expected: postgres, redis, server, web all healthy

- [ ] **Step 2: Seed demo data**

```bash
docker compose exec server pnpm --filter @restaurant/db db:seed
```

Expected: Demo restaurant seeded

- [ ] **Step 3: Test demo flow end-to-end**

1. Open `http://localhost:5173/demo`
2. Click "Waiter" → redirected to `/waiter/tables`
3. DemoBanner visible at top
4. Click a free table → order page loads
5. Click 2-3 menu items to add to cart
6. Click "Send to Kitchen" → redirected to tables
7. Click "Switch to Kitchen" in DemoBanner
8. Kitchen display shows the new order
9. Click "Start" on an item → status changes to "preparing"
10. Click "Ready" on all items → order status auto-promotes to "ready"
11. Click "Switch to Waiter" → order table shows green (ready)
12. Click "Switch to Cashier" → order shows in cashier tables
13. Click the ready table → cashier order detail page
14. Click "Mark Served"
15. Table returns to free

- [ ] **Step 4: Test admin flow**

1. Open `http://localhost:5173/demo`, click "Admin"
2. Navigate to `/admin/menu` → categories and items visible
3. Add a new menu item → appears in table
4. Navigate to `/admin/inventory` → ingredients visible
5. Click "Restock" → modal opens, add stock, save
6. Navigate to `/admin/reports` → summary stats visible
7. Switch periods — charts update

- [ ] **Step 5: Verify real-time (two browser tabs)**

1. Tab A: Waiter view at `/waiter/tables`
2. Tab B: Kitchen view at `/kitchen`
3. In Tab A: create and place new order
4. Tab B: kitchen should show the new order within 1-2 seconds (no page refresh needed)

- [ ] **Step 6: Run E2E tests against dev stack**

```bash
cd e2e && pnpm test
```

Expected: All tests pass

- [ ] **Step 7: Final commit**

```bash
git add .
git commit -m "chore: all phases complete — rewrite ready for production deployment

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 9: Production Smoke Tests (Post-Deploy)

Run these after `./deploy.sh` completes:

- [ ] **Health check:**
  ```bash
  curl -f https://humerez.dev/restaurant/api/health
  ```
  Expected: `{"status":"ok"}`

- [ ] **Login page loads:**
  ```bash
  curl -I https://humerez.dev/restaurant/login
  ```
  Expected: HTTP 200

- [ ] **PWA manifest:**
  ```bash
  curl -I https://humerez.dev/restaurant/manifest.webmanifest
  ```
  Expected: HTTP 200, `Content-Type: application/manifest+json`

- [ ] **Service worker:**
  ```bash
  curl -I https://humerez.dev/restaurant/service-worker.js
  ```
  Expected: HTTP 200, `Cache-Control: no-store, no-cache, must-revalidate`

- [ ] **WebSocket upgrade (tRPC subscriptions):**
  Open browser dev tools on `/restaurant/admin`, Network tab, filter WS.
  Expected: One WebSocket connection to `/restaurant/api/trpc` in state "101 Switching Protocols"

- [ ] **Demo mode:**
  Navigate to `https://humerez.dev/restaurant/demo`
  Expected: Role picker page renders, clicking "Waiter" creates session and redirects
