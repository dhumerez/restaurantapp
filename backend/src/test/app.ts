import express from "express";
import { createServer } from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import { errorHandler } from "../middleware/errorHandler.js";
import { initSocket } from "../socket/index.js";

import authRoutes from "../modules/auth/auth.routes.js";
import menuRoutes from "../modules/menu/menu.routes.js";
import ordersRoutes from "../modules/orders/orders.routes.js";
import kitchenRoutes from "../modules/kitchen/kitchen.routes.js";
import tablesRoutes from "../modules/orders/tables.routes.js";
import adminRoutes from "../modules/admin/admin.routes.js";

export function createApp() {
  const app = express();
  const httpServer = createServer(app);

  initSocket(httpServer);

  app.use(cors({ origin: "http://localhost:5173", credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api", menuRoutes);
  app.use("/api/orders", ordersRoutes);
  app.use("/api/kitchen", kitchenRoutes);
  app.use("/api/tables", tablesRoutes);
  app.use("/api/admin", adminRoutes);

  app.use(errorHandler);

  return { app, httpServer };
}
