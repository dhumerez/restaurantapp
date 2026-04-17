# Restaurant Admin Link + Subscription Tier Plan

> Follow-up to `2026-04-16-superadmin-platform.md`. Keep it additive.

**Goal:** Let a superadmin (a) assign an admin to a restaurant (either by picking a pending user or by creating a new one), (b) manage a restaurant's subscription tier (`free | subscribed | allaccess`), and (c) see/create users across the whole platform. No gating changes — that's a follow-up.

**Model decisions:**
- Subscription lives on `restaurants`, not on `user`. Staff inherit from their restaurant.
- "Admin of a restaurant" = any `user` row where `role = 'admin' AND restaurantId = <that restaurant>`. No dedicated FK column on `restaurants`. Multiple admins allowed.
- Seed: demo restaurant → `subscriptionTier = 'allaccess'`. New restaurants default to `'free'`.

**Branch:** `feature/restaurant-admin-subscription` (new, off master, **after PR #3 merges**).

---

## Task 1: Add `subscriptionTier` to `restaurants` table

**Files:** `packages/db/src/schema.ts`, new migration.

- [ ] Add to `restaurants` table:
  ```ts
  subscriptionTier: text("subscription_tier").notNull().default("free"),
  ```
- [ ] `pnpm --filter @restaurant/db db:generate` — inspect the SQL. Expected: `ALTER TABLE "restaurants" ADD COLUMN "subscription_tier" text NOT NULL DEFAULT 'free';`
- [ ] Append to the generated `.sql`:
  ```sql
  UPDATE "restaurants" SET "subscription_tier" = 'allaccess' WHERE slug = 'demo';
  ```
- [ ] `pnpm --filter @restaurant/db db:migrate`. Verify: `SELECT slug, subscription_tier FROM restaurants;` → demo = `allaccess`.
- [ ] Update seed (`apps/server/src/scripts/seed.ts`): when inserting the demo restaurant, set `subscriptionTier: "allaccess"`.
- [ ] Commit: `feat: add subscription_tier to restaurants`.

---

## Task 2: Extend `superadmin.restaurants.update` with tier + return shape

**Files:** `apps/server/src/router/superadmin.ts`, tests.

- [ ] Extend input: `subscriptionTier: z.enum(["free","subscribed","allaccess"]).optional()`.
- [ ] Extend `superadmin.restaurants.get` return so `restaurant.subscriptionTier` is present (free via `select *`, nothing to change beyond types).
- [ ] Add a vitest case in `superadmin.restaurants.test.ts` that asserts `update` accepts `subscriptionTier` and persists it (mock the `update().set()` call-shape).
- [ ] Commit: `feat: superadmin can set restaurant subscription tier`.

---

## Task 3: `superadmin.restaurants.assignAdmin` (TDD)

**Files:** new `apps/server/src/router/superadmin.assignAdmin.test.ts`, `superadmin.ts`.

- [ ] Write tests for three shapes:
  1. `{ restaurantId, mode: "existing", userId }` — updates user: `role=admin, restaurantId, isActive=true, emailVerified=true`.
  2. `{ restaurantId, mode: "new", email, name, password }` — calls `auth.signUpEmail`, then patches the new row the same way.
  3. Fails if `restaurantId` not found (`NOT_FOUND`). Fails if `mode=existing` and `userId` not found (`NOT_FOUND`). Fails if `mode=new` and email already registered (`CONFLICT`).
- [ ] Implement in `superadmin.ts`. Reuse logic from `pendingUsers.assign` (same final update). For `mode: "new"`, call `ctx.auth.api.signUpEmail({ body: { email, password, name } })`, then patch.
- [ ] Commit: `feat: superadmin.restaurants.assignAdmin for existing + new users`.

---

## Task 4: `superadmin.users.list` + `superadmin.users.create` (TDD)

**Files:** extend `superadmin.ts`, tests.

- [ ] `users.list`: return every user joined with their restaurant (`{ id, name, email, role, isActive, createdAt, restaurant: { id, name, slug, status, subscriptionTier } | null }`). Order by `createdAt desc`.
- [ ] `users.create`: same shape as `assignAdmin.mode="new"` but role + restaurantId are optional (use case: create a superadmin, create a pending user). Returns the created user.
- [ ] Vitest: list returns joined shape; create with full role+restaurant persists; create without role returns pending user; create with duplicate email → `CONFLICT`.
- [ ] Commit: `feat: superadmin.users list + create`.

---

## Task 5: Restaurant detail — admin block + subscription tier control

**Files:** `apps/web/src/routes/_app/platform/restaurants.$restaurantId.tsx`.

- [ ] **Admins section** (above Personal):
  - Shows list of users with `role=admin` for this restaurant (filter from `data.staff`).
  - If list is empty: render a card "No hay admin asignado" with two actions:
    - "Asignar existente" → dropdown of pending users (`superadmin.pendingUsers.list`), confirm → `assignAdmin({ restaurantId, mode: "existing", userId })`.
    - "Crear nuevo" → inline form (email, name, password) → `assignAdmin({ restaurantId, mode: "new", ... })`.
  - If list is non-empty: render each admin + an "Agregar admin" button that opens the same two actions.
- [ ] **Subscription tier** next to the existing status dropdown:
  - `<select>` with `free | subscribed | allaccess`, bound to `update.mutate({ id, subscriptionTier: ... })`.
- [ ] Invalidate `restaurants.get` and `pendingUsers.list` on success.
- [ ] Commit: `feat: restaurant detail page — assign admin + subscription tier`.

---

## Task 6: `/platform/users` list page

**Files:** new `apps/web/src/routes/_app/platform/users.tsx`, `AppShell.tsx` (nav link).

- [ ] Nav link under "Restaurantes": "Usuarios" (`Users` icon), roles `["superadmin"]`.
- [ ] Page: table with columns `Nombre | Correo | Rol | Restaurante | Tier | Activo | Creado`. Restaurant name links to detail page.
- [ ] Top-right "Crear usuario" button → modal with `name`, `email`, `password`, optional `role` dropdown (null | admin | waiter | kitchen | cashier | superadmin), optional `restaurantId` dropdown (populated from `superadmin.restaurants.list`). Calls `superadmin.users.create`.
- [ ] Search box (client-side substring on name + email) — no server pagination yet.
- [ ] Commit: `feat: superadmin users list + create modal`.

---

## Task 7: E2E coverage

**Files:** extend `e2e/tests/superadmin.spec.ts`.

- [ ] Test: from detail page, create a new admin for the demo restaurant with a random email; expect the admin block to show the new user; clean up by demoting via `pendingUsers` revert — or just live with the extra test user (seed is idempotent). Acceptable to skip cleanup; the test should pick a unique email per run.
- [ ] Test: open `/platform/users`, filter by search, open "Crear usuario" modal, create a pending user (no role), verify row appears in list.
- [ ] Test: flip subscription tier on the detail page, reload, verify it persists.
- [ ] Commit: `test: e2e for admin assignment + users page`.

---

## Wrap-up

- [ ] Run full e2e suite + server tests.
- [ ] Push branch, open PR.
- [ ] Do **not** merge until manual smoke passes.

---

## Out of scope (future work)

- Trial expiry cron / auto-transition `free → suspended` after N days.
- Self-serve subscription flow (Stripe/local QR).
- Gating logic on `subscriptionTier` (today only `restaurants.status` gates; tier is informational until the follow-up).
- Removing an admin / transferring ownership.
- Email invitations instead of password-in-form for admin creation.
