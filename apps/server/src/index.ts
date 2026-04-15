import "dotenv/config";
import { env } from "./config/env.js";
import { buildApp } from "./app.js";
import { startDemoCron } from "./lib/demoCron.js";

const app = await buildApp();
await app.listen({ port: env.PORT, host: "0.0.0.0" });
console.log(`Server running on port ${env.PORT}`);
startDemoCron();
