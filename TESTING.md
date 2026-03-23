# Restaurant POS — Testing Plan & Progress

## Overview

This document tracks the test implementation status across the entire Restaurant POS project.

Three test layers are used:
- **Unit Tests** — Fast, no DB, test isolated logic (Vitest)
- **Integration Tests** — Full API endpoint tests against real PostgreSQL (Vitest + Supertest)
- **E2E Tests** — Full browser flows using seeded demo data (Playwright)

---

## Status Summary

| Layer | Tests | Status | Command |
|---|---|---|---|
| Backend Unit | 17 | ✅ All passing | `cd backend && npm test` |
| Backend Integration | 48 | ✅ All passing | `cd backend && npm test` |
| Frontend Component | 13 | ✅ All passing | `cd frontend && npm test` |
| E2E (Playwright) | 20 | ⚠️ Requires running app | `cd e2e && npm test` |
| **Total (unit+integration+component)** | **78** | ✅ **All passing** | |

---

## Backend Tests (`backend/`)

### Tools
- **Vitest** v4 — test runner
- **Supertest** — HTTP assertions against Express app
- **Vitest coverage** (`@vitest/coverage-v8`) — available via `npm run test -- --coverage`

### Configuration
- `backend/vitest.config.ts` — includes all `src/**/*.test.ts` files
- `backend/src/test/setup.ts` — sets env vars (`DATABASE_URL`, `JWT_SECRET`, etc.) before any module imports
- `backend/src/test/app.ts` — creates isolated Express app instance for integration tests (no port binding)
- `backend/src/test/helpers.ts` — `seedTestData()` / `cleanupTestData()` for isolated test data per suite

### Unit Tests — `src/middleware/*.test.ts`

| File | Tests | What's covered |
|---|---|---|
| `auth.test.ts` | 8 | `authenticate` (missing token, invalid, expired, valid), `authorize` (no user, wrong role, correct role, multi-role) |
| `errorHandler.test.ts` | 5 | AppError → correct status, NotFoundError 404, UnauthorizedError 401, ZodError → 400 + details, unknown → 500 |
| `validate.test.ts` | 3 | Valid input passes + sets body, invalid throws ZodError, unknown fields stripped |

### Integration Tests — `src/modules/**/*.integration.test.ts`

Each suite: `beforeAll` seeds isolated data, `afterAll` cleans up.

| File | Tests | Endpoints covered |
|---|---|---|
| `auth.integration.test.ts` | 9 | POST /login (valid, invalid email, wrong password, bad format), GET /me (no token, valid), POST /logout |
| `orders.integration.test.ts` | 14 | POST / (auth, role, create, 404 table), PUT /:id (add items), POST /:id/place (stock decrement, already-placed), GET / (filtered by waiter, admin, status), GET /:id (detail, 404), PATCH /:id/cancel |
| `kitchen.integration.test.ts` | 8 | GET /orders (403 waiter, 200 kitchen, 200 admin), PATCH /items/:id/status (preparing, ready, 404), PATCH /orders/:id/status (400 invalid, 200 served) |
| `menu.integration.test.ts` | 12 | GET /categories (200, 401), POST /categories (admin, 403 waiter), PUT, DELETE; GET /menu-items, POST with/without stock, PATCH /stock (set number, set null), DELETE |
| `admin.integration.test.ts` | 5 | GET /staff (403 non-admin, 200 list), POST /staff (create), PUT /staff/:id (update), DELETE /staff/:id (deactivate) |

### Bug Fixed During Testing
**`asyncHandler` wrapper** (`src/utils/asyncHandler.ts`) — Express 4 does not catch rejected promises from async route handlers. All routes were updated to wrap async controllers. This was a pre-existing silent bug where errors from async handlers caused unhandled promise rejections instead of HTTP error responses.

---

## Frontend Tests (`frontend/`)

### Tools
- **Vitest** v4 + **jsdom** — browser-like environment
- **@testing-library/react** — component rendering
- **@testing-library/jest-dom** — DOM matchers (`toBeInTheDocument`, etc.)

### Configuration
- `frontend/vite.config.ts` — `test` block added: globals, jsdom environment, setupFiles
- `frontend/src/test/setup.ts` — imports `@testing-library/jest-dom/vitest`

### Component Tests

| File | Tests | What's covered |
|---|---|---|
| `components/layout/ProtectedRoute.test.tsx` | 5 | Loading spinner, redirect when unauthenticated, renders children when auth'd, role match renders, role mismatch redirects |
| `components/layout/Sidebar.test.tsx` | 5 | Returns null when no user, admin sees all 7 nav items, waiter sees only Tables+Orders, kitchen sees only Kitchen, logout button visible |
| `components/layout/Header.test.tsx` | 3 | Title renders, avatar initial shown when authenticated, avatar hidden when not authenticated |

---

## E2E Tests (`e2e/`)

### Tools
- **Playwright** v1.58 — browser automation
- **Chromium** — default test browser

### Configuration
- `e2e/playwright.config.ts` — baseURL: `http://localhost:5173`, sequential workers, 30s timeout
- Demo data from `backend/src/db/seed.ts` used as fixtures

### Prerequisites
E2E tests require the full stack running:
```bash
# Option A: Docker Compose
docker compose up

# Option B: Manual
cd backend && npm run dev     # :3000
cd frontend && npm run dev    # :5173
```

Seed must be applied once:
```bash
cd backend && npm run db:push && npm run db:seed
```

### Test Suites

| File | Tests | Scenarios |
|---|---|---|
| `tests/auth.spec.ts` | 6 | Login page visible, unauthenticated redirect, invalid credentials error, admin login→dashboard, waiter login→tables, kitchen login→kitchen, logout clears session |
| `tests/waiter.spec.ts` | 6 | Tables grid visible, navigate to orders list, create order from table, cannot access admin pages, no kitchen link in sidebar, correct sidebar items |
| `tests/kitchen.spec.ts` | 5 | Kitchen display page, user name + logout visible, cannot access waiter pages, cannot access admin pages, empty state |
| `tests/admin.spec.ts` | 7 | Dashboard visible, all 7 nav items in sidebar, menu management (seeded items), staff management (seeded staff), table config, orders, kitchen |

### Running E2E
```bash
cd e2e
npm test             # headless
npm run test:headed  # see the browser
npm run test:ui      # Playwright UI mode
npm run report       # view last HTML report
```

---

## Running All Tests

### Backend (unit + integration)
```bash
cd backend
npm test
# Expected: 8 test files, 65 tests — all passing
```

### Frontend (component)
```bash
cd frontend
npm test
# Expected: 3 test files, 13 tests — all passing
```

### E2E (requires running stack)
```bash
# Start stack first (see prerequisites above)
cd e2e
npm test
```

### CI Pipeline (recommended order)
```bash
cd backend && npm test       # Unit + integration (no browser needed)
cd frontend && npm test      # Component tests (no browser needed)
cd e2e && npm test           # E2E (needs running app)
```

---

## What's Tested vs. Not Tested

### ✅ Covered
- Auth middleware (token validation, role authorization)
- Error handling (all error types → correct HTTP status)
- Input validation (Zod schema rejection)
- Full order lifecycle: draft → items → place → (preparing → ready) → served
- Stock decrement on place, restore on cancel
- Kitchen item status transitions
- Kitchen order auto-status sync
- Waiter order filtering (waiters only see own orders)
- Admin CRUD for menu, categories, staff, tables
- Role-based access control on all endpoints
- ProtectedRoute component (all 5 states)
- Sidebar role-based navigation
- Header user display
- Full login/logout flow (E2E)
- Role-based redirect after login (E2E)
- Page accessibility for each role (E2E)

### 🔲 Not Yet Covered (future work)
- Real-time Socket.IO event propagation tests
- Stock out (0 stock) blocking order placement
- Concurrent order placement race condition
- Refresh token rotation
- PWA offline behavior
- Mobile viewport E2E tests
- Performance/load testing

---

## Adding New Tests

### Backend unit test
Create `src/[module]/[name].test.ts`, no DB interaction needed.

### Backend integration test
Create `src/modules/[module]/[name].integration.test.ts`, use `seedTestData()` + `cleanupTestData()` from `src/test/helpers.ts`.

### Frontend component test
Create `src/[path]/[Component].test.tsx`, mock `useAuth` via `vi.mock("../../context/AuthContext", ...)`.

### E2E test
Add a new `e2e/tests/[feature].spec.ts`. Use the seeded demo users. Mark as `test.describe(...)` and use page objects for reusable login helpers.
