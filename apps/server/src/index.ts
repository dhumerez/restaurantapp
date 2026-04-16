import "dotenv/config";
import path from "node:path";
import { runMigrations } from "@restaurant/db";
import { env } from "./config/env.js";
import { buildApp } from "./app.js";
import { startDemoCron } from "./lib/demoCron.js";

const migrationsFolder = path.resolve(process.cwd(), "packages/db/drizzle");
console.log(`Running migrations from ${migrationsFolder}`);
await runMigrations(env.DATABASE_URL, migrationsFolder);
console.log("Migrations applied");

const app = await buildApp();
await app.listen({ port: env.PORT, host: "0.0.0.0" });
console.log(`Server running on port ${env.PORT}`);
if (env.NODE_ENV === "production") {
  startDemoCron();
}
