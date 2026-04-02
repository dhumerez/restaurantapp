import express from "express";
import { createServer } from "http";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./config/env.js";
import { pool } from "./config/db.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { initSocket } from "./socket/index.js";
import { rateLimiter } from "./middleware/rateLimiter.js";

// Route imports
import authRoutes from "./modules/auth/auth.routes.js";
import menuRoutes from "./modules/menu/menu.routes.js";
import ordersRoutes from "./modules/orders/orders.routes.js";
import kitchenRoutes from "./modules/kitchen/kitchen.routes.js";
import tablesRoutes from "./modules/orders/tables.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import superadminRoutes from "./modules/superadmin/superadmin.routes.js";
import reportsRoutes from "./modules/reports/reports.routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function bootstrap() {
  // Run migrations on startup (safe to run repeatedly — only applies new ones)
  if (env.NODE_ENV !== "test") {
    try {
      const db = drizzle(pool);
      await migrate(db, { migrationsFolder: path.join(__dirname, "db/migrations") });
      console.log("Database migrations applied.");
    } catch (err) {
      console.error("Migration error:", err);
      // Don't crash — DB might already be up-to-date via push in dev
    }
  }

  const app = express();
  app.set("trust proxy", 1);
  const httpServer = createServer(app);

  initSocket(httpServer);

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  // Global rate limit: 100 requests per minute per IP
  const globalLimiter = rateLimiter(100, 60 * 1000, "Too many requests. Try again later.");
  app.use("/api", globalLimiter);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api", menuRoutes);
  app.use("/api/orders", ordersRoutes);
  app.use("/api/kitchen", kitchenRoutes);
  app.use("/api/tables", tablesRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/superadmin", superadminRoutes);
  app.use("/api/reports", reportsRoutes);

  app.use(errorHandler);

  httpServer.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  return app;
}

bootstrap().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
