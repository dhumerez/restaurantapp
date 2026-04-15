import { router } from "../trpc/trpc.js";
import { menuRouter } from "./menu.js";
import { tablesRouter } from "./tables.js";
import { staffRouter } from "./staff.js";
import { ordersRouter } from "./orders.js";
import { kitchenRouter } from "./kitchen.js";
import { reportsRouter } from "./reports.js";

export const appRouter = router({
  menu: menuRouter,
  tables: tablesRouter,
  staff: staffRouter,
  orders: ordersRouter,
  kitchen: kitchenRouter,
  reports: reportsRouter,
});

export type AppRouter = typeof appRouter;
