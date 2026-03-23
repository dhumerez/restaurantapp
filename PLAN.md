# Restaurant POS Web Application - Implementation Plan

## Progress Tracking

| Phase | Status | Notes |
|---|---|---|
| Phase 1: Foundation | DONE | Docker, DB schema, auth, seed, login page |
| Phase 2: Menu Management | DONE | Categories + items CRUD, stock count handling |
| Phase 3: Waiter Ordering | DONE | Tables, orders, placement with stock decrement |
| Phase 4: Kitchen Display + Real-Time | DONE | Socket.IO, kitchen tickets, status updates, audio chime |
| Phase 5: Admin, PWA & Polish | PARTIAL | Admin dashboard, staff mgmt, table mgmt done. PWA not started |
| Phase 6: Testing | NOT STARTED | No Vitest, no Playwright, no test files exist |
| Phase 7: Production Readiness | PARTIAL | Docker Compose exists, health check done. No CI/CD, no pino logging |

### Detailed Task Tracking

#### Phase 1: Foundation - DONE
- [x] Init monorepo, Docker Compose (postgres + backend + frontend)
- [x] Database schema with Drizzle (7 tables: restaurants, users, categories, menuItems, tables, orders, orderItems)
- [x] Initial migration
- [x] Auth module: login, JWT access (15min) + refresh (7d) in httpOnly cookies
- [x] Role middleware (authenticate + authorize)
- [x] Seed script: demo restaurant, 3 users (admin/waiter/kitchen), 4 categories, 12 menu items, 10 tables
- [x] Login page with role-based redirect

#### Phase 2: Menu Management - DONE
- [x] Backend: categories CRUD (GET/POST/PUT/DELETE `/api/categories`)
- [x] Backend: menu items CRUD (GET/POST/PUT/DELETE `/api/menu-items`, PATCH `/api/menu-items/:id/stock`)
- [x] Frontend: MenuManagementPage (category sidebar, item grid, add/edit modal)
- [x] Stock count handling (NULL = unlimited, number = tracked)

#### Phase 3: Waiter Ordering - DONE
- [x] Backend: tables CRUD
- [x] Backend: orders CRUD with draft -> placed flow
- [x] Backend: stock decrement on order placement, restore on cancel
- [x] Frontend: TablesPage with grid showing table status (free/occupied)
- [x] Frontend: OrderPage with menu browser, cart, item notes, send to kitchen
- [x] Frontend: OrdersListPage with status filters and date grouping
- [x] Backend: waiter can only see their own orders

#### Phase 4: Kitchen Display + Real-Time - DONE
- [x] Socket.IO setup with JWT auth middleware
- [x] Room-based events per restaurant (kitchen:{id}, waiter:{id})
- [x] Kitchen endpoints: GET active orders, PATCH item status, PATCH order status
- [x] KitchenDisplayPage: full-screen tickets, status buttons (Start/Done/Served), color coding
- [x] Audio chime on new orders
- [x] Real-time: waiter places order -> kitchen sees instantly
- [x] Real-time: kitchen updates item -> waiter sees status change
- [x] Real-time: TablesPage updates via socket (not just polling)
- [x] Real-time: OrderPage shows live item statuses + toast on ready
- [x] Kitchen display includes "ready" orders (not just placed/preparing)
- [x] Kitchen logout button
- [x] "Mark Order Served" button when all items ready
- [x] Waiter "Mark as Served" button via `PATCH /api/orders/:id/serve`

#### Phase 5: Admin, PWA & Polish - PARTIAL
- [x] Admin DashboardPage with stats
- [x] StaffManagementPage: full CRUD (list, create, edit, activate/deactivate)
- [x] Backend: admin routes registered (`/api/admin/staff`)
- [x] TableManagementPage: grid view with add/edit/delete
- [x] Sidebar navigation with role-based visibility
- [x] Loading/empty/error states on all pages
- [ ] **PWA setup**: manifest.json, service worker, app icons, "Add to Home Screen"
- [ ] **Responsive design audit**: mobile-first for waiter views, tablet-optimized for kitchen

#### Phase 6: Testing - NOT STARTED
- [ ] **Setup**: Install Vitest, configure for both backend and frontend
- [ ] **Setup**: Install Playwright, configure browser targets
- [ ] **Setup**: Docker Compose test profile with isolated postgres instance
- [ ] **Backend unit tests (Vitest)**:
  - [ ] Auth service: login, JWT generation/verification, refresh flow
  - [ ] Orders service: create, place (stock decrement), cancel (stock restore), serve
  - [ ] Kitchen service: get active orders, update item status, sync order status
  - [ ] Menu service: CRUD, stock count handling (NULL vs number)
  - [ ] Middleware: auth middleware (valid/invalid/expired tokens), role guard
- [ ] **Backend integration tests (Vitest)**:
  - [ ] Auth endpoints: login, refresh, logout, me
  - [ ] Menu endpoints: CRUD with auth
  - [ ] Order endpoints: full lifecycle (create -> add items -> place -> update statuses -> serve)
  - [ ] Kitchen endpoints: active orders query, status updates
  - [ ] Admin endpoints: staff CRUD
  - [ ] Authorization: verify role restrictions on all endpoints
- [ ] **Frontend component tests (Vitest + React Testing Library)**:
  - [ ] OrderTicket: renders items, status badges, action buttons
  - [ ] Sidebar: shows correct nav items per role
  - [ ] ProtectedRoute: redirects unauthorized users
- [ ] **E2E tests (Playwright)**:
  - [ ] Login flow for each role (admin, waiter, kitchen)
  - [ ] Admin: create category -> create menu item -> verify in list
  - [ ] Admin: create staff member -> verify in list
  - [ ] Waiter: select table -> add items to order -> send to kitchen
  - [ ] Kitchen: see new order -> mark items preparing -> mark ready
  - [ ] Waiter: see order ready notification -> mark served
  - [ ] Full lifecycle: waiter creates order -> kitchen processes -> waiter serves

#### Phase 7: Production Readiness - PARTIAL
- [x] Docker Compose for local dev
- [x] Health check endpoint (`/api/health`)
- [ ] **Multi-stage Dockerfiles** (production builds)
- [ ] **docker-compose.prod.yml** with nginx, SSL
- [ ] **Structured logging** (pino)
- [ ] **Multi-tenant onboarding script**
- [ ] **CI/CD**: GitHub Actions (test on push, deploy on merge to main)
- [ ] **Deployment documentation**

---

## Context

Build a production-ready restaurant POS (Point of Sale) webapp from scratch. The reference repo (amritmaurya1504/Restaurant_POS_System) was evaluated but has too many gaps for production use: hardcoded menus, no kitchen view, no real-time updates, no multi-tenancy, no tests. Building from scratch is faster than patching.

The user plans to sell this product to multiple restaurants, so cost-effectiveness and self-hosting are priorities. Supabase and Vercel are explicitly excluded due to per-project SaaS costs scaling poorly across multiple deployments.

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite + TypeScript | No SSR needed for POS; static build served by nginx |
| Styling | Tailwind CSS | Fast, no runtime cost, small bundles |
| State/Data | React Context + React Query | Lightweight, no Redux overhead |
| Backend | Node.js + Express + TypeScript | Simple, no lock-in, familiar ecosystem |
| Database | PostgreSQL | Relational data fits naturally; handles concurrent writes; free |
| ORM | Drizzle ORM | Lightweight, TS-native, no binary dependency (unlike Prisma) |
| Real-time | Socket.IO | Kitchen display needs instant push; handles reconnection + rooms |
| Auth | JWT (access + refresh tokens) | Stateless, no Redis/session store needed |
| Mobile | PWA (Progressive Web App) | $0 extra, same codebase, works on Android+iOS, "Add to Home Screen" |
| Unit Tests | Vitest | Fast, native Vite integration, works for both backend and frontend |
| E2E Tests | Playwright | Cross-browser, reliable, CLI-friendly for CI/CD |
| Deployment | Docker Compose on Hetzner VPS | ~$5-6/month covers everything (nginx + app + DB) |

---

## Database Schema

**restaurants** - Multi-tenancy root. Fields: id (UUID), name, slug (unique), currency, tax_rate.

**users** - Staff accounts. Fields: id, restaurant_id (FK), name, email, password_hash, role (`admin`|`waiter`|`kitchen`), is_active. Unique on (restaurant_id, email).

**categories** - Menu categories. Fields: id, restaurant_id (FK), name, sort_order, is_active.

**menu_items** - Menu items. Fields: id, restaurant_id (FK), category_id (FK), name, description, price, image_url, **stock_count** (NULL = unlimited), is_available, sort_order.

**tables** - Restaurant tables. Fields: id, restaurant_id (FK), number, label, seats, is_active.

**orders** - Order header. Fields: id, restaurant_id (FK), table_id (FK), waiter_id (FK), status (`draft`|`placed`|`preparing`|`ready`|`served`|`cancelled`), notes, subtotal, tax, total.

**order_items** - Individual items in an order. Fields: id, order_id (FK cascade), menu_item_id (FK), quantity, unit_price (snapshot), item_name (snapshot), notes, status (`pending`|`preparing`|`ready`|`served`|`cancelled`).

Key design decisions:
- `stock_count = NULL` means unlimited (no count tracking)
- Price/name snapshotted in order_items so menu edits don't alter history
- Separate status on order vs order_items so kitchen can mark items ready independently
- `restaurant_id` on every table enables multi-tenancy via row filtering

---

## API Routes

**Auth**: POST `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`; GET `/api/auth/me`

**Categories** (admin write, all read): GET/POST `/api/categories`, PUT/DELETE `/api/categories/:id`

**Menu Items** (admin write, all read): GET/POST `/api/menu-items`, PUT/DELETE `/api/menu-items/:id`, PATCH `/api/menu-items/:id/stock`

**Tables** (admin CRUD, waiter read): GET/POST `/api/tables`, PUT/DELETE `/api/tables/:id`

**Orders** (waiter): GET/POST `/api/orders`, GET/PUT `/api/orders/:id`, POST `/api/orders/:id/place`, PATCH `/api/orders/:id/serve`, PATCH `/api/orders/:id/cancel`

**Kitchen**: GET `/api/kitchen/orders`, PATCH `/api/kitchen/items/:id/status`, PATCH `/api/kitchen/orders/:id/status`

**Admin**: GET/POST/PUT/DELETE `/api/admin/staff`

---

## Real-Time (Socket.IO)

- Rooms per restaurant: `kitchen:{restaurant_id}`, `waiter:{restaurant_id}`
- **Waiter places order** -> emits `order:new` to kitchen room
- **Kitchen updates item** -> emits `order:item-updated` to both rooms
- **Order ready** -> emits `order:ready` to waiter room (with audio chime)
- **Menu availability change** -> emits `menu:updated` to all rooms
- Socket auth via JWT in handshake

---

## Frontend Pages

| Page | Role | Status | Description |
|---|---|---|---|
| Login | All | DONE | Email/password, redirect by role |
| Dashboard | Admin | DONE | Today's orders, revenue, popular items |
| Menu Management | Admin | DONE | CRUD categories + items, stock toggle |
| Staff Management | Admin | DONE | CRUD staff users with roles |
| Table Management | Admin | DONE | CRUD tables (number, label, seats) |
| Tables | Waiter | DONE | Grid of tables with status (free/occupied), real-time updates |
| Orders List | Waiter | DONE | Status filter tabs, date grouping, real-time updates |
| Order | Waiter | DONE | Menu browser, cart with notes, send to kitchen, mark served |
| Kitchen Display | Kitchen | DONE | Full-screen tickets, status buttons, audio alerts, logout |

---

## Hosting & Cost

- **Hetzner CX22**: ~$5.39/month (2 vCPU, 4GB RAM) - runs nginx + Node.js + PostgreSQL in Docker
- **Domain + SSL**: Free via Let's Encrypt
- **Multiple restaurants**: Same VPS via multi-tenancy (shared DB, filtered by restaurant_id)
- **Scaling path**: Move DB to managed service (~$15/mo) when needed, add app servers behind load balancer

---

## Expected End-to-End Flow

```
WAITER                          KITCHEN                         ADMIN
------                          -------                         -----
Login -> Tables page            Login -> Kitchen Display        Login -> Dashboard
Click Table 3 -> Order page                                    Manage Menu (categories + items)
Add items (with notes) -> cart                                  Manage Staff (CRUD)
"Send to Kitchen" ->            <- "New order!" toast + chime   Manage Tables (CRUD)
                                See Table 3 ticket              View Orders + Kitchen
                                Click "Start" on item ->
Tables page updates instantly     preparing
Order page shows "preparing"
                                Click "Done" on item ->
Tables page turns green           ready
Order page shows "ready"        Ticket turns green
Toast: "Table 3 order ready!"
Click "Mark as Served" ->       Ticket disappears
Table 3 shows "Available"
```

---

## What's Next

Priority order for remaining work:

1. **Phase 6: Testing** - No tests exist at all. Need Vitest + Playwright setup and comprehensive test coverage.
2. **PWA setup** - manifest.json, service worker, icons for mobile waiter access.
3. **Production Dockerfiles** - Multi-stage builds, nginx with SSL.
4. **CI/CD** - GitHub Actions pipeline.
5. **Structured logging** - Replace console.log with pino.
