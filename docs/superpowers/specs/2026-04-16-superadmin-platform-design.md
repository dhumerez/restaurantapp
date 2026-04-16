# Superadmin Platform — Design

**Date:** 2026-04-16
**Status:** Approved — ready for implementation plan
**Branch:** `feature/superadmin-platform`

## Context

The app already has a `superadmin` role, a `superadminProcedure`, a `superadminRouter` (`restaurants.list/create/update`, `pendingUsers.list/approve`), and two platform pages (`/platform/restaurants`, `/platform/pending-users`). The redirect from `/` already sends superadmin users to `/platform/restaurants` after login.

Three gaps prevent the superadmin flow from being useful end to end:

1. **No restaurant detail page.** The superadmin can see a list and create, but cannot open a specific restaurant to review its stats or staff.
2. **No lockout enforcement when a restaurant is deactivated.** Flipping `restaurants.status` to `inactive` has no effect on that restaurant's users.
3. **No sidebar nav for superadmin**, no seeded superadmin account, and no configurable platform contact information.

This design closes those three gaps. Out of scope: impersonation ("login as any user"), billing/tier management, platform-wide analytics, audit logging, per-restaurant contact overrides.

## Decisions

- **Login model:** Superadmin uses the normal `/login` page. No separate entry point, no impersonation.
- **Lockout model:** Any restaurant whose status is not `active` or `trial` blocks all of its users (admin, waiter, kitchen, cashier) from the app. They land on `/restaurant-inactive` with a configurable contact block.
- **Contact info:** Stored in a singleton `platform_settings` row. Editable from `/platform/settings`.
- **First superadmin:** Seeded in `apps/server/src/scripts/seed.ts` as `superadmin@demo.com` / `password123`.

## Architecture

### Data model changes

New table `platform_settings` (Drizzle):

```ts
platformSettings = pgTable("platform_settings", {
  id: text("id").primaryKey().default("singleton"),
  contactEmail: text("contact_email").notNull().default(""),
  contactPhone: text("contact_phone").notNull().default(""),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

A check constraint (or application-level guard) enforces `id = 'singleton'`. The migration inserts the singleton row with empty strings for email/phone.

No other schema changes. The existing `restaurants.status` enum (`active | trial | suspended | inactive`) stays as-is.

### tRPC surface

**New procedures:**

| Procedure | Type | Input | Returns |
|---|---|---|---|
| `superadmin.restaurants.get` | query | `{ id: uuid }` | `{ restaurant, stats, staff }` (see below) |
| `superadmin.settings.get` | query | — | `{ contactEmail, contactPhone }` |
| `superadmin.settings.update` | mutation | `{ contactEmail, contactPhone }` | `{ contactEmail, contactPhone }` |
| `me.context` | protected query | — | `{ user, restaurantStatus }` |
| `platform.publicContact` | public query | — | `{ contactEmail, contactPhone }` |

`superadmin.restaurants.get` returns:

```ts
{
  restaurant: Restaurant,  // full row
  stats: {
    staffCount: number,
    tableCount: number,
    menuItemCount: number,
    orderCount30d: number,
  },
  staff: Array<{ id, name, email, role, isActive, createdAt }>,
}
```

Counts use `count()` aggregates. Staff is a plain `select` filtered by `restaurantId`.

`me.context` returns `restaurantStatus: null` for superadmin (no `restaurantId`) or when the restaurant row no longer exists.

`platform.publicContact` is intentionally public — it is called from `/restaurant-inactive`, which must render before any auth-protected procedure could succeed.

**Changed procedure:**

`restaurantProcedure` (in `apps/server/src/trpc/trpc.ts`) gains a status check after the existing `isActive` guard:

```ts
const r = await ctx.db.query.restaurants.findFirst({ where: eq(restaurants.id, ctx.user.restaurantId) });
if (!r || (r.status !== "active" && r.status !== "trial")) {
  throw new TRPCError({ code: "FORBIDDEN", message: "RESTAURANT_INACTIVE" });
}
```

The sentinel message `RESTAURANT_INACTIVE` is how the client differentiates lockout from ordinary FORBIDDEN.

### Frontend routes

| Path | Role | Purpose |
|---|---|---|
| `/_app/platform/restaurants` (existing) | superadmin | List — each row links to detail |
| `/_app/platform/restaurants/$restaurantId` (new) | superadmin | Detail: info, stats, staff, status toggle |
| `/_app/platform/pending-users` (existing) | superadmin | Approval queue |
| `/_app/platform/settings` (new) | superadmin | Edit platform contact email/phone |
| `/restaurant-inactive` (new) | restaurant user | Full-screen lockout with contact info |

The detail page is read-only for restaurant fields. The only mutation from the page is the status dropdown, which calls the existing `superadmin.restaurants.update`.

### Lockout flow

`_app.tsx` `beforeLoad` is extended:

1. No session → redirect `/login` (unchanged).
2. `role === null` → redirect `/pending` (unchanged).
3. `role === "superadmin"` → proceed.
4. Fetch `me.context`. If `restaurantStatus` is not `active` or `trial` → redirect `/restaurant-inactive`.
5. Else proceed.

`/restaurant-inactive` is a top-level route (sibling of `/login`, not under `_app`). It calls `platform.publicContact` on mount and renders:

- Heading: "Tu restaurante ha sido desactivado"
- Message: "Comunícate con el administrador de la plataforma para reactivar el acceso."
- Email (mailto:) and phone. If both empty: fallback text "El administrador aún no ha configurado información de contacto".
- "Cerrar sesión" button calling `authClient.signOut()`.

Server-side defense in depth: even if a stale client bypasses the redirect, `restaurantProcedure` rejects every downstream call with `RESTAURANT_INACTIVE`.

### Sidebar nav (superadmin)

`apps/web/src/components/AppShell.tsx` — `navItems` gets three entries with `roles: ["superadmin"]`:

- Restaurants → `/platform/restaurants` (`Building2`)
- Usuarios pendientes → `/platform/pending-users` (`UserCheck`)
- Ajustes → `/platform/settings` (`Settings`)

### Bootstrap

`apps/server/src/scripts/seed.ts` creates the superadmin before the demo restaurant:

```ts
await auth.api.signUpEmail({
  body: { email: "superadmin@demo.com", password: PASSWORD, name: "Platform Admin" },
});
await db
  .update(user)
  .set({ role: "superadmin", isActive: true, emailVerified: true })
  .where(eq(user.email, "superadmin@demo.com"));
```

The seed also upserts the `platform_settings` singleton row.

**Pre-existing bug surfaced by this change:** the seed inserts the demo restaurant with `status: "demo"`, which is not a member of the enum. The new `restaurantProcedure` guard will reject all demo-restaurant traffic. Fix in the same PR by changing seed status to `"active"`.

## Restaurant detail page layout

```
┌─ ← Back to restaurants ───────────────────────┐
│ Restaurant Name                               │
│ [Status: active ▾] (dropdown)                 │
├───────────────────────────────────────────────┤
│ Información                                   │
│   Slug · Dirección · Moneda · Tasa de imp.    │
│   Creado el                                   │
├───────────────────────────────────────────────┤
│ Estadísticas                                  │
│   Personal · Mesas · Productos · Órdenes (30d)│
├───────────────────────────────────────────────┤
│ Personal                                      │
│   Tabla: Nombre | Correo | Rol | Activo       │
└───────────────────────────────────────────────┘
```

Restaurant fields are read-only. Editing name / slug / address / currency / taxRate stays where it is today (only creation from the list page).

## Error handling

| Case | Behavior |
|---|---|
| Superadmin's own `restaurantId` is `null` | `_app.tsx` skips the status check (role === superadmin branch). |
| Restaurant row deleted mid-session | `me.context` returns `restaurantStatus: null` → treated as lockout. |
| Status flipped to `inactive` mid-session | Next `me.context` call on route change redirects. Live sessions are not force-kicked (YAGNI on realtime). |
| `superadmin.restaurants.get` called with unknown id | Throws `NOT_FOUND`; page renders "Restaurante no encontrado" with back link. |
| `platform_settings` row absent | `superadmin.settings.get` upserts the singleton with empty defaults. |
| Lockout screen with no contact info configured | Shows heading + message + fallback contact text. |
| Non-superadmin visits `/platform/*` | `superadminProcedure` throws FORBIDDEN; route `beforeLoad` also redirects to `/`. |

## Testing

### Backend (existing tRPC test harness)

- `superadmin.restaurants.get` — returns correct stats + staff, 404 on bad id, FORBIDDEN for non-superadmin.
- `superadmin.settings.get` / `update` — reads default singleton, updates, rejects non-superadmin.
- `me.context` — returns `restaurantStatus` for restaurant users, `null` for superadmin.
- `restaurantProcedure` guard — throws `RESTAURANT_INACTIVE` for `inactive` / `suspended`; allows `active` / `trial`.

### E2E (existing Playwright suite)

- **Lockout flow:** admin logs in → superadmin flips the restaurant to `inactive` → admin's next navigation lands on `/restaurant-inactive` showing configured contact info.
- **Superadmin nav:** superadmin login shows Restaurants / Pending / Settings in sidebar; each route loads.
- **Existing suites must continue to pass** after the seed status fix.

## YAGNI / explicit non-goals

- No impersonation or "act as"
- No audit log of status changes
- No bulk restaurant operations
- No email notification when a restaurant is deactivated
- No per-restaurant contact overrides (platform contact only)
- No soft-delete / archive
- No platform-wide analytics dashboard
- No editing restaurant details from the detail page (only status)

## Files touched

**New:**

- `apps/server/src/router/platform.ts` — public `platform.publicContact` query
- `apps/server/src/router/me.ts` — protected `me.context` query
- Migration for `platform_settings`
- `packages/db/src/schema.ts` — add `platformSettings` table
- `apps/web/src/routes/_app/platform/restaurants.$restaurantId.tsx`
- `apps/web/src/routes/_app/platform/settings.tsx`
- `apps/web/src/routes/restaurant-inactive.tsx`

**Modified:**

- `apps/server/src/router/superadmin.ts` — add `restaurants.get`, `settings.get`, `settings.update`
- `apps/server/src/router/index.ts` — mount `platform` and `me` routers
- `apps/server/src/trpc/trpc.ts` — extend `restaurantProcedure` with status check
- `apps/server/src/scripts/seed.ts` — seed superadmin + platform_settings; change demo restaurant status from `demo` to `active`
- `apps/web/src/routes/_app.tsx` — `me.context` fetch + lockout redirect
- `apps/web/src/routes/_app/platform/restaurants.tsx` — wrap row names in Link to detail
- `apps/web/src/components/AppShell.tsx` — three superadmin nav items
