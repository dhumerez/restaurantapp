import { router } from "../trpc/trpc.js";
import { menuRouter } from "./menu.js";
import { tablesRouter } from "./tables.js";
import { staffRouter } from "./staff.js";
import { ordersRouter } from "./orders.js";
import { kitchenRouter } from "./kitchen.js";
import { reportsRouter } from "./reports.js";
import { notificationsRouter } from "./notifications.js";
import { authRouter } from "./auth.js";
import { inventoryRouter } from "./inventory.js";
import { superadminRouter } from "./superadmin.js";
import { pushRouter } from "./push.js";

export const appRouter = router({
  auth: authRouter,
  menu: menuRouter,
  tables: tablesRouter,
  staff: staffRouter,
  orders: ordersRouter,
  kitchen: kitchenRouter,
  reports: reportsRouter,
  notifications: notificationsRouter,
  inventory: inventoryRouter,
  superadmin: superadminRouter,
  push: pushRouter,
});

export type AppRouter = typeof appRouter;
