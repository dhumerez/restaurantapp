import { initTRPC, TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { restaurants } from "@restaurant/db";
import type { Context } from "./context.js";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user || !ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, user: ctx.user, session: ctx.session } });
});

export const superadminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "superadmin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});

const ALLOWED_RESTAURANT_STATUSES = new Set(["active", "trial", "demo"]);

export const restaurantProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user.restaurantId || !ctx.user.role) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No restaurant assigned" });
  }
  if (!ctx.user.isActive) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Account deactivated" });
  }
  const r = await ctx.db.query.restaurants.findFirst({
    where: eq(restaurants.id, ctx.user.restaurantId),
  });
  if (!r || !ALLOWED_RESTAURANT_STATUSES.has(r.status)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "RESTAURANT_INACTIVE" });
  }
  return next({
    ctx: {
      ...ctx,
      restaurantId: ctx.user.restaurantId,
      role: ctx.user.role,
      restaurant: r,
    },
  });
});

export const adminProcedure = restaurantProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});

export const waiterProcedure = restaurantProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "waiter" && ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});

export const kitchenProcedure = restaurantProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "kitchen" && ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});

export const cashierProcedure = restaurantProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "cashier" && ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});
