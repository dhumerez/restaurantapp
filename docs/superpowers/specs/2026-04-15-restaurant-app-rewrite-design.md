# Restaurant App — Full Rewrite Design Spec

**Date:** 2026-04-15
**Status:** Approved

---

## Goal

Complete rewrite of the restaurant POS application. Same features as today plus ingredient-level inventory management and enhanced reports. Rebuilt on a modern, fully type-safe stack to eliminate all existing data integrity bugs, architectural inconsistencies, and security issues identified in the current codebase.

---

## Tech Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Backend framework | Fastify | 2-4x throughput over Express, first-class TypeScript |
| API layer | tRPC v11 | End-to-end type safety, zero schema duplication |
| Real-time | tRPC subscriptions over WebSocket | Typed events, replaces Socket.IO entirely |
| Auth | Better Auth | Self-hosted, Drizzle adapter, Google OAuth, anonymous sessions for demo |
| ORM | Drizzle ORM | Unchanged — type-safe, migration-based, PostgreSQL |
| Database | PostgreSQL 16 | Unchanged |
| Frontend framework | React 19 | Unchanged |
| Frontend router | TanStack Router | Type-safe routes + search params, unified with TanStack Query |
| Server state | TanStack Query v5 | Unchanged |
| UI components | shadcn/ui + Tailwind CSS | Production-quality accessible components, keeps dark design system |
| UI design | ui-ux-pro-max + frontend-design skills | Applied to all UI phases |
| Notification state | Zustand | Single slice for in-session notification history |
| Rate limiting | Redis (ioredis) | Persistent rate limit counters — survives server restarts, multi-instance safe |
| PWA | vite-plugin-pwa (Workbox) + Web Push API (VAPID) | Installable, offline shell, native push notifications |
| Monorepo | pnpm workspaces + Turborepo | Type sharing, build caching, scalable to future apps |
| Containerization | Docker + Docker Compose | Dev + prod configurations |
| Reverse proxy | Traefik | TLS termination via Let's Encrypt, path-based routing |

---

## Repository Structure

```
pnpm-workspace.yaml
turbo.json
├── apps/
│   ├── server/              Fastify + tRPC + Better Auth + Drizzle
│   └── web/                 React 19 + TanStack Router + shadcn/ui
└── packages/
    └── db/                  Drizzle schema + migrations + seed (shared source of truth)
```

---

## Architecture

### Request Flow
```
Browser
  → TanStack Router (type-safe navigation)
  → TanStack Query (cache + mutations)
  → tRPC HTTP client (queries/mutations)
  → Fastify server
  → tRPC router (procedure guards)
  → service layer
  → Drizzle ORM
  → PostgreSQL

Browser (real-time)
  → tRPC WebSocket client
  → tRPC subscription procedures
  → event emitter (per-restaurant channels)
  → Fastify server
```

### Auth Flow
```
Login page (Better Auth UI)
  → Google OAuth or email/password
  → Better Auth session (httpOnly cookie — NO localStorage)
  → tRPC context extracts session on every request
  → procedure middleware narrows user type by role
```

### Demo Flow
```
Landing page "Try Demo" → role picker
  → Better Auth anonymous session (no email required)
  → guest session scoped to demo restaurant (status: "demo")
  → full app experience with pre-seeded data
  → DemoBanner with role switcher throughout session
  → session expires after 2 hours
  → cron resets demo restaurant data every 2 hours
```

---

## Data Model

### Auth Tables (Better Auth managed)
```sql
user            id, name, email, emailVerified, image,
                role*,         -- "superadmin" | "admin" | "waiter" | "kitchen" | "cashier" | null
                restaurantId*, -- null for superadmin and pending users
                isActive*,     -- false = deactivated
                createdAt, updatedAt
                (* = custom fields via Better Auth schema extension)

session         id, userId, token, expiresAt, ipAddress, userAgent
account         id, userId, providerId, accountId  (Google OAuth)
verification    id, identifier, value, expiresAt
```

### Restaurant Tables
```sql
restaurants
  id uuid PK, name, slug (unique), address, currency, taxRate decimal(5,2),
  status "active"|"trial"|"suspended"|"inactive"|"demo",
  createdAt, updatedAt

categories
  id, restaurantId FK, name, sortOrder int, isActive bool, createdAt
  INDEX: restaurantId

menu_items
  id, restaurantId FK, categoryId FK, name, description, price decimal(10,2),
  imageUrl, isAvailable bool, sortOrder int, createdAt, updatedAt
  INDEX: restaurantId, categoryId
  NOTE: no stockCount — stock tracked via ingredients

tables
  id, restaurantId FK, number int, label, seats int, isActive bool
  UNIQUE: (restaurantId, number)

orders
  id, restaurantId FK, tableId FK, waiterId FK (user.id),
  status "draft"|"placed"|"preparing"|"ready"|"served"|"cancelled",
  notes, discountType "none"|"percentage"|"fixed",
  discountValue decimal(10,2), discountAmount decimal(10,2), discountReason,
  subtotal decimal(10,2), tax decimal(10,2), total decimal(10,2),
  createdAt, updatedAt
  INDEX: restaurantId, status, (restaurantId, status)

order_items
  id, orderId FK (CASCADE), menuItemId FK,
  quantity int, unitPrice decimal(10,2), itemName varchar,
  notes, status "pending"|"preparing"|"ready"|"served"|"cancelled",
  createdAt
  INDEX: orderId

order_events
  id, orderId FK (CASCADE), userId FK,
  action "created"|"items_updated"|"placed"|"status_changed"|
         "item_status_changed"|"transferred"|"merged"|
         "discount_applied"|"served"|"cancelled",
  details jsonb, createdAt
```

### Inventory Tables (new)
```sql
ingredients
  id, restaurantId FK, name, unit "g"|"kg"|"ml"|"L"|"units",
  currentStock decimal(10,3),   -- auto-updated on order place/cancel
  minStock decimal(10,3),       -- triggers low-stock alert when currentStock ≤ minStock
  costPerUnit decimal(10,4),    -- for cost reports
  updatedAt
  INDEX: restaurantId

recipe_items
  id, menuItemId FK, ingredientId FK, quantity decimal(10,3)
  UNIQUE: (menuItemId, ingredientId)

inventory_transactions
  id, restaurantId FK, ingredientId FK,
  type "purchase"|"usage"|"waste"|"adjustment",
  quantity decimal(10,3),   -- positive = stock in, negative = stock out
  orderId uuid nullable FK, -- links usage deductions to the order that caused them
  notes text nullable,
  createdBy userId FK,
  createdAt
  INDEX: restaurantId, ingredientId, (restaurantId, createdAt)
```

### Stock Flow Rules
- **Order placed** → for each order item, look up `recipe_items`, multiply by quantity → deduct from `ingredients.currentStock` → insert `inventory_transactions` type `"usage"` linked to `orderId`
- **Order cancelled** → restore quantities by reversing the `inventory_transactions` rows for that `orderId`
- **Kitchen cancels item** → restore ingredient quantities for that item only; do NOT double-restore on full order cancel
- **Admin restocks** → insert `"purchase"` transaction → `currentStock` increases
- **Low stock** → after any deduction, if `currentStock ≤ minStock` → emit `inventory.onLowStock` subscription event to admin

---

## Multi-tenancy & Security

### Isolation Rules
1. `restaurantId` **always comes from the session context**, never from user input
2. Every DB query on a restaurant-scoped table includes `WHERE restaurant_id = ctx.session.restaurantId`
3. PostgreSQL Row-Level Security enforces `restaurant_id = current_setting('app.restaurant_id')` as a second layer — DB rejects queries even if application code has a bug
4. Demo restaurant is isolated — `status: "demo"`, guest sessions can only see its data

### Procedure Middleware Chain
```typescript
publicProcedure              // no auth (health, demo landing)
  └── protectedProcedure     // valid Better Auth session
        ├── superadminProcedure   // role === "superadmin"
        └── restaurantProcedure   // role !== null + restaurantId in session
              ├── adminProcedure       // role === "admin"
              ├── waiterProcedure      // role === "waiter"
              ├── kitchenProcedure     // role === "kitchen"
              └── cashierProcedure     // role === "cashier" | "admin"
```

---

## Permissions Matrix

| Action | Superadmin | Admin | Waiter | Cashier | Kitchen |
|--------|-----------|-------|--------|---------|---------|
| Manage restaurants | ✅ | ❌ | ❌ | ❌ | ❌ |
| Approve/assign users | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage staff + roles | ❌ | ✅ | ❌ | ❌ | ❌ |
| Manage menu | ❌ | ✅ | ❌ | ❌ | ❌ |
| Manage inventory + recipes | ❌ | ✅ | ❌ | ❌ | ❌ |
| View reports | ❌ | ✅ | ❌ | ❌ | ❌ |
| Create/edit order | ❌ | ✅ | ✅ own | ❌ | ❌ |
| Cancel order | ❌ | ✅ any | ✅ own | ✅ any | ❌ |
| Apply discount | ❌ | ✅ | ✅ | ✅ | ❌ |
| Mark order served | ❌ | ✅ | ✅ | ✅ | ❌ |
| Transfer/merge order | ❌ | ✅ | ✅ | ✅ | ❌ |
| Kitchen display | ❌ | ✅ | ❌ | ❌ | ✅ |
| Update item/order status | ❌ | ✅ | ❌ | ❌ | ✅ |

---

## tRPC Router Structure

```
appRouter
├── auth
│   ├── getSession            public
│   └── demo.create           public — creates ephemeral guest session with role
│
├── restaurant                superadminProcedure
│   ├── list / create / update
│   └── pendingUsers.list / approve
│
├── staff                     adminProcedure
│   ├── list / create / update / deactivate
│   NOTE: create always sets isEmailVerified: true
│
├── menu
│   ├── categories            list: restaurantProcedure | create/update/delete: adminProcedure
│   └── items                 list: restaurantProcedure | create/update/delete/uploadImage: adminProcedure
│
├── tables
│   ├── list                  restaurantProcedure
│   └── create/update/delete  adminProcedure
│
├── orders
│   ├── list                  restaurantProcedure (waiters filtered to own)
│   ├── get                   restaurantProcedure
│   ├── create / update / place   waiterProcedure | adminProcedure
│   ├── serve                 waiterProcedure | cashierProcedure | adminProcedure
│   ├── cancel                waiterProcedure (own) | cashierProcedure | adminProcedure
│   ├── applyDiscount         waiterProcedure | cashierProcedure | adminProcedure
│   ├── transfer / merge      waiterProcedure | cashierProcedure | adminProcedure
│   └── events.list           restaurantProcedure
│
├── kitchen
│   ├── activeOrders.list     kitchenProcedure | adminProcedure
│   ├── item.updateStatus     kitchenProcedure | adminProcedure
│   └── order.updateStatus    kitchenProcedure | adminProcedure
│
├── inventory                 adminProcedure
│   ├── ingredients.list / create / update / delete
│   ├── recipes.get / upsert
│   └── transactions.list
│
├── reports                   adminProcedure
│   ├── orders.summary        period: "day" | "week" | "month"
│   ├── orders.byWaiter       period: "day" | "week" | "month"
│   ├── orders.byHour         period: "day" | "week" | "month"
│   ├── orders.revenue        period: "day" | "week" | "month"
│   ├── inventory.usage       period: "day" | "week" | "month"
│   ├── inventory.cost        period: "day" | "week" | "month"
│   └── inventory.lowStock    current snapshot
│
└── notifications             tRPC SUBSCRIPTIONS (WebSocket)
    ├── orders.onChange       restaurantProcedure
    │     events: placed | updated | cancelled | served | ready
    │     payload: { event: string, order: Order }
    ├── kitchen.onChange      kitchenProcedure | adminProcedure
    │     events: order_placed | item_status_changed | order_cancelled
    │     payload: { event: string, order: Order }
    ├── inventory.onLowStock  adminProcedure
    │     payload: { ingredient: Ingredient, currentStock: number, minStock: number }
    └── menu.onChange         restaurantProcedure
          events: item_updated | item_deleted
          payload: { event: string, menuItem: MenuItem }
```

### Real-Time Notification Matrix

| Event | Subscription | Notified roles |
|-------|-------------|----------------|
| Order placed | orders.onChange + kitchen.onChange | waiter(own), cashier, admin, kitchen |
| Item status changed | orders.onChange | waiter(own), cashier, admin |
| Order → ready | orders.onChange | waiter(own), cashier, admin |
| Order cancelled | orders.onChange + kitchen.onChange | all except kitchen can't cancel |
| Stock ≤ minStock | inventory.onLowStock | admin only |
| Menu item updated | menu.onChange | all roles |

---

## Frontend Structure

### Routes (TanStack Router)
```
/                           → redirect based on role
/login                      Better Auth UI (email/password + Google)
/verify-email               token handler
/pending                    pending approval screen
/demo                       role picker → creates guest session

/platform/restaurants       superadmin
/platform/restaurants/$id
/platform/pending-users

/_app                       restaurant shell (sidebar + header)
  /admin                    dashboard
  /admin/menu               menu management
  /admin/staff              staff + roles
  /admin/tables             table management
  /admin/inventory          ingredients + recipes
  /admin/reports            day/week/month — orders + inventory
  /waiter/tables            table grid
  /waiter/orders            orders list
  /waiter/orders/$id        order detail + cart editor
  /kitchen                  full-screen KDS
  /cashier/tables           table grid (read-only)
  /cashier/orders/$id       order detail — discount, serve, cancel, print
```

### Key Components
- `AppShell` — sidebar + header, role-aware nav
- `DemoBanner` — sticky demo mode indicator + role switcher
- `NotificationCenter` — bell icon, last 10 alerts (order:ready, low stock)
- `CartPanel` — reusable order cart (waiter + admin)
- `RecipeEditor` — link ingredients to menu item with quantities
- `PeriodSelector` — day/week/month tab switcher for reports
- `RevenueChart` / `InventoryUsageChart` — shadcn charts

### Real-Time Hooks
```typescript
useOrderSubscription()      // trpc.notifications.orders.onChange
useKitchenSubscription()    // trpc.notifications.kitchen.onChange
useInventoryAlerts()        // trpc.notifications.inventory.onLowStock
useMenuSubscription()       // trpc.notifications.menu.onChange
```

All subscriptions are mounted once in the `_app` layout and feed into a shared Zustand notification store. Components subscribe to the store, not directly to tRPC subscriptions.

---

## Order Status Machine

```
draft → placed → preparing → ready → served
                                ↓
              cancelled (from any non-terminal state except kitchen cannot cancel)
```

- `draft` → `placed`: waiter/admin places order; ingredients deducted from stock
- `placed` → `preparing`: kitchen starts preparing (manual or auto on first item)
- `preparing` → `ready`: auto when all non-cancelled items reach "ready" status
- `ready` → `served`: waiter/cashier/admin marks served
- Any → `cancelled`: waiter(own)/cashier/admin; stock restored for non-already-cancelled items only

### Item Status Machine
```
pending → preparing → ready → served
       ↓
    cancelled (kitchen or admin only — NOT waiter or cashier)
```

When kitchen cancels an item → ingredient stock restored immediately for that item.
When order is cancelled → ingredient stock restored only for items NOT already individually cancelled.

---

## Inventory Management

### Ingredient Tracking
- Each menu item optionally has a `recipe` (list of ingredients + quantities)
- Simple items (e.g., bottled beverages) use a single-ingredient recipe
- When no recipe exists for a menu item, no stock tracking occurs for that item
- Admin can set `minStock` per ingredient — low-stock alert fires when `currentStock ≤ minStock`

### Reports (day / week / month)
Period definitions: `"day"` = current calendar day (midnight to now), `"week"` = current Mon–Sun week, `"month"` = current calendar month. All periods use the restaurant's local timezone.

**Order reports:**
- Revenue summary (total, subtotal, tax, discounts)
- Orders by waiter (count, total revenue)
- Orders by hour (heatmap)
- Top-selling items (quantity, revenue)

**Inventory reports:**
- Ingredient usage (quantity consumed per period)
- Ingredient cost (usage × costPerUnit)
- Low stock snapshot (current vs. minStock)
- Waste log (manual waste transactions)

---

## Demo Mode

- Demo restaurant row with `status: "demo"` pre-seeded with realistic data:
  - 10 tables, 3 categories, 15 menu items, 8 ingredients with recipes
  - Active orders in various states across all status values
- Better Auth anonymous plugin creates a guest session scoped to the demo restaurant
- `DemoBanner` shows current role + switch buttons for all 4 roles
- Switching role: create new anonymous session, redirect to role home
- All real mutations work in demo — data resets via cron every 2 hours
- Cron re-runs the demo seed for the demo restaurant only (does not touch real data)
- Registering from demo: Better Auth upgrades anonymous session to real user

---

## Security

- Access tokens: **never in localStorage** — Better Auth uses httpOnly session cookies only
- PostgreSQL RLS: second layer of tenant isolation at DB level
- `restaurantId` injection: always from session context, never from request body
- Admin-created staff: `isEmailVerified: true` always — they are pre-trusted
- Rate limiting: Redis-backed (replace current in-memory limiter) — survives server restarts
- CORS: strict origin allowlist
- Helmet: HTTP security headers on all responses
- Input validation: Zod schemas on all tRPC inputs (enforced by tRPC middleware)

---

## PWA

### Web App Manifest
```json
{
  "name": "Tu Restaurante",
  "short_name": "Restaurante",
  "display": "standalone",
  "orientation": "portrait-primary",
  "theme_color": "#08090e",
  "background_color": "#08090e",
  "start_url": "/",
  "lang": "es",
  "icons": [
    { "src": "/icons/icon-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512x512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon.svg", "sizes": "any", "type": "image/svg+xml" },
    { "src": "/icons/apple-touch-icon.png", "sizes": "180x180", "type": "image/png", "purpose": "apple touch icon" }
  ]
}
```

### Service Worker (Workbox via vite-plugin-pwa, `injectManifest` strategy)
| Route type | Strategy | Notes |
|-----------|----------|-------|
| App shell (HTML/JS/CSS) | `CacheFirst` | Always loads fast from cache |
| tRPC API calls | `NetworkFirst` | Fresh when online, last-known when offline |
| Menu item images (R2/CDN) | `CacheFirst` + 7-day expiry | Food photos rarely change |
| Google Fonts / static assets | `StaleWhileRevalidate` | Fast + eventually fresh |

### Web Push Notifications (VAPID)
- VAPID key pair generated once, stored in server env (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`)
- New DB table:
```sql
push_subscriptions
  id, userId FK, endpoint text, p256dh text, auth text,
  userAgent text nullable, createdAt, updatedAt
  INDEX: userId
```
- On login: browser requests notification permission → subscription POSTed to `trpc.notifications.push.subscribe`
- On `order:ready` → server sends Web Push to the waiter's subscribed devices (works with tab closed/backgrounded)
- On `inventory.onLowStock` → server sends Web Push to admin's devices
- On `order:cancelled` (while kitchen has it active) → push to kitchen devices
- Push payload: `{ title, body, url }` — tapping opens the relevant order/ingredient page

### Offline Behaviour
- **Kitchen display** — shows last-cached active orders with `[Sin conexión]` banner; no mutations allowed offline
- **Tables page** — shows cached table grid; tapping a table shows a "reconnecting…" state
- **Order page** — mutations (place, serve, cancel) queue locally and retry automatically on reconnect using Background Sync API
- All offline states show a consistent `OfflineBanner` component with a reconnect indicator

### Install Prompt
- `beforeinstallprompt` event captured in a Zustand slice
- Shown as a subtle bottom sheet after 30 seconds of use for `waiter`, `kitchen`, and `cashier` roles (these users work all day on tablets/phones)
- Dismissed state persisted in `localStorage` (only non-sensitive UI preference stored there)

---

## Server Configuration

### Docker Compose Services

**Development (`docker-compose.yml`)**
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
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      retries: 5

  server:
    build:
      context: ./apps/server
      dockerfile: Dockerfile.dev
    depends_on:
      postgres: { condition: service_healthy }
      redis:    { condition: service_healthy }
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/restaurant
      REDIS_URL: redis://redis:6379
      BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET}
      BETTER_AUTH_URL: http://localhost:3000
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
      RESEND_API_KEY: ${RESEND_API_KEY}
      R2_ACCOUNT_ID: ${R2_ACCOUNT_ID}
      R2_ACCESS_KEY: ${R2_ACCESS_KEY}
      R2_SECRET_KEY: ${R2_SECRET_KEY}
      R2_BUCKET: ${R2_BUCKET}
      R2_PUBLIC_URL: ${R2_PUBLIC_URL}
      VAPID_PUBLIC_KEY: ${VAPID_PUBLIC_KEY}
      VAPID_PRIVATE_KEY: ${VAPID_PRIVATE_KEY}
      VAPID_SUBJECT: mailto:admin@humerez.dev
      NODE_ENV: development
      PORT: 3000
    ports:
      - "3000:3000"
    volumes:
      - ./apps/server/src:/app/src   # hot reload

  web:
    build:
      context: ./apps/web
      dockerfile: Dockerfile.dev
    environment:
      VITE_API_URL: http://localhost:3000
      VITE_BASE_PATH: /
      VITE_VAPID_PUBLIC_KEY: ${VAPID_PUBLIC_KEY}
    ports:
      - "5173:5173"
    volumes:
      - ./apps/web/src:/app/src      # hot reload

volumes:
  postgres_data:
```

**Production (`docker-compose.prod.yml`)**
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
      R2_ACCOUNT_ID: ${R2_ACCOUNT_ID}
      R2_ACCESS_KEY: ${R2_ACCESS_KEY}
      R2_SECRET_KEY: ${R2_SECRET_KEY}
      R2_BUCKET: ${R2_BUCKET}
      R2_PUBLIC_URL: ${R2_PUBLIC_URL}
      VAPID_PUBLIC_KEY: ${VAPID_PUBLIC_KEY}
      VAPID_PRIVATE_KEY: ${VAPID_PRIVATE_KEY}
      VAPID_SUBJECT: mailto:admin@humerez.dev
      NODE_ENV: production
      PORT: 3000
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

### Nginx (frontend container — serves built static files)
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # PWA — never cache service worker or manifest
    location ~* (service-worker\.js|manifest\.webmanifest)$ {
        add_header Cache-Control "no-store, no-cache, must-revalidate";
        try_files $uri =404;
    }

    # Hashed assets — cache forever
    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }

    # SPA fallback — all routes → index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Traefik (on host — manages TLS for all services)
Traefik runs as a separate Docker Compose stack on the host (`humerez.dev`). It handles:
- TLS certificates via Let's Encrypt (HTTP-01 challenge)
- Path-based routing: `/restaurant/*` → restaurant app, `/restaurant/api/*` → server
- WebSocket upgrade forwarding for tRPC subscriptions (`Connection: Upgrade` headers preserved)
- Automatic HTTP → HTTPS redirect

### Environment Variables

**Server (`apps/server/.env`)**
```env
# Database
DATABASE_URL=postgresql://postgres:PASSWORD@postgres:5432/restaurant

# Redis
REDIS_URL=redis://redis:6379

# Better Auth
BETTER_AUTH_SECRET=min-32-char-random-string
BETTER_AUTH_URL=https://humerez.dev          # prod | http://localhost:3000 dev

# Google OAuth
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx

# Email (Resend)
RESEND_API_KEY=re_xxx                        # optional — logs to console if absent
RESEND_FROM=noreply@humerez.dev

# Cloudflare R2 image storage
R2_ACCOUNT_ID=xxx                            # optional — image upload disabled if absent
R2_ACCESS_KEY=xxx
R2_SECRET_KEY=xxx
R2_BUCKET=restaurant-menu
R2_PUBLIC_URL=https://pub-xxx.r2.dev

# Web Push (VAPID)
VAPID_PUBLIC_KEY=xxx                         # generate once: npx web-push generate-vapid-keys
VAPID_PRIVATE_KEY=xxx
VAPID_SUBJECT=mailto:admin@humerez.dev

# Server
PORT=3000
NODE_ENV=production                          # development | production | test
CORS_ORIGIN=https://humerez.dev             # dev: http://localhost:5173
```

**Web (`apps/web/.env`)**
```env
VITE_API_URL=                                # empty = same-origin in prod; http://localhost:3000 in dev
VITE_BASE_PATH=/restaurant/                  # prod | / dev
VITE_VAPID_PUBLIC_KEY=xxx                    # same as server VAPID_PUBLIC_KEY
```

### Dockerfiles

**`apps/server/Dockerfile` (production)**
```dockerfile
FROM node:22-alpine AS base
RUN npm install -g pnpm turbo

FROM base AS builder
WORKDIR /app
COPY . .
RUN turbo prune server --docker

FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml .
RUN pnpm install --frozen-lockfile

FROM installer AS runner
WORKDIR /app
COPY --from=builder /app/out/full/ .
RUN pnpm turbo build --filter=server
EXPOSE 3000
CMD ["node", "apps/server/dist/index.js"]
```

**`apps/web/Dockerfile` (production)**
```dockerfile
FROM node:22-alpine AS base
RUN npm install -g pnpm turbo

FROM base AS builder
WORKDIR /app
COPY . .
RUN turbo prune web --docker

FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml .
RUN pnpm install --frozen-lockfile

FROM installer AS runner
WORKDIR /app
COPY --from=builder /app/out/full/ .
ARG VITE_API_URL VITE_BASE_PATH VITE_VAPID_PUBLIC_KEY
RUN pnpm turbo build --filter=web
FROM nginx:alpine
COPY --from=runner /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### Deployment Script (`deploy.sh`)
```bash
#!/bin/bash
set -e
IMAGE_TAG=$(git rev-parse --short HEAD)
GITHUB_REPO=yourusername/restaurant-app

# Build and push images
docker build -t ghcr.io/$GITHUB_REPO/server:$IMAGE_TAG \
  --build-arg TURBO_TEAM=$TURBO_TEAM \
  --build-arg TURBO_TOKEN=$TURBO_TOKEN \
  -f apps/server/Dockerfile .

docker build -t ghcr.io/$GITHUB_REPO/web:$IMAGE_TAG \
  --build-arg VITE_API_URL="" \
  --build-arg VITE_BASE_PATH="/restaurant/" \
  --build-arg VITE_VAPID_PUBLIC_KEY=$VAPID_PUBLIC_KEY \
  -f apps/web/Dockerfile .

docker push ghcr.io/$GITHUB_REPO/server:$IMAGE_TAG
docker push ghcr.io/$GITHUB_REPO/web:$IMAGE_TAG

# Deploy on server
ssh deploy@humerez.dev "
  cd /opt/restaurant &&
  IMAGE_TAG=$IMAGE_TAG docker compose -f docker-compose.prod.yml pull &&
  IMAGE_TAG=$IMAGE_TAG docker compose -f docker-compose.prod.yml up -d --remove-orphans
"
```

---

## Implementation Phases

1. **Monorepo + server setup** — pnpm workspaces, Turborepo, Docker Compose (dev + prod), Dockerfiles, Nginx, Traefik labels, env files
2. **Database** — `packages/db`: schema (all tables + indexes + RLS + push_subscriptions), migrations, seed
3. **Auth** — Better Auth: email/password + Google OAuth + anonymous sessions (demo)
4. **Core backend** — Fastify + tRPC server: all routers, procedure middleware, service layer
5. **Real-time** — tRPC WebSocket subscriptions + event emitter system + Redis rate limiting
6. **PWA** — vite-plugin-pwa, service worker caching strategies, Web Push (VAPID), offline banners, install prompt
7. **Frontend shell** — TanStack Router, auth flow, demo mode, layout, notification center, DemoBanner
8. **Waiter flow** — tables page, order creation/editing, order page (with cancel)
9. **Kitchen flow** — kitchen display, item/order status updates
10. **Cashier flow** — order detail, discount, serve, cancel, print receipt
11. **Admin flow** — menu, staff, tables, inventory, recipes
12. **Reports** — day/week/month charts for orders + inventory (shadcn charts)
13. **Platform (superadmin)** — restaurant management, user approval
14. **UI polish** — ui-ux-pro-max + frontend-design skill applied to all pages
15. **E2E tests** — Playwright coverage for all critical flows per role
16. **Production deploy** — deploy.sh, GitHub Container Registry, smoke test on humerez.dev
