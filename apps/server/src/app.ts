import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import websocket from "@fastify/websocket";
import {
  fastifyTRPCPlugin,
  type FastifyTRPCPluginOptions,
} from "@trpc/server/adapters/fastify";
import { appRouter, type AppRouter } from "./router/index.js";
import { createContext } from "./trpc/context.js";
import { auth } from "./lib/auth.js";
import { env } from "./config/env.js";

export async function buildApp() {
  const app = Fastify({ logger: env.NODE_ENV !== "test" });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
  });
  await app.register(cookie);
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });
  await app.register(websocket);

  // Better Auth — all /api/auth/* routes
  app.all("/api/auth/*", async (req, reply) => {
    return auth.handler(req.raw, reply.raw);
  });

  // tRPC
  await app.register(fastifyTRPCPlugin, {
    prefix: "/api/trpc",
    useWSS: true,
    trpcOptions: {
      router: appRouter,
      createContext,
      onError: ({ error }) => {
        if (error.code === "INTERNAL_SERVER_ERROR") {
          console.error("tRPC internal error:", error);
        }
      },
    } satisfies FastifyTRPCPluginOptions<AppRouter>["trpcOptions"],
  });

  app.get("/api/health", async () => ({ status: "ok" }));

  return app;
}
