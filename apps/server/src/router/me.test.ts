import { describe, it, expect } from "vitest";
import { initTRPC, TRPCError } from "@trpc/server";

const t = initTRPC.create();

const buildContextProcedure = () => {
  return t.procedure.query(async (opts: any) => {
    const { ctx } = opts;
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
    if (ctx.user.role === "superadmin" || !ctx.user.restaurantId) {
      return { user: ctx.user, restaurantStatus: null };
    }
    const r = await ctx.db.query.restaurants.findFirst();
    return { user: ctx.user, restaurantStatus: r?.status ?? null };
  });
};

const makeCaller = (ctx: any) => {
  const r = t.router({ context: buildContextProcedure() });
  return r.createCaller(ctx);
};

describe("me.context", () => {
  it("returns restaurantStatus for restaurant users", async () => {
    const c = makeCaller({
      user: { id: "u1", role: "admin", restaurantId: "r1" },
      db: { query: { restaurants: { findFirst: async () => ({ status: "active" }) } } },
    });
    await expect(c.context()).resolves.toMatchObject({ restaurantStatus: "active" });
  });

  it("returns null restaurantStatus for superadmin", async () => {
    const c = makeCaller({
      user: { id: "u1", role: "superadmin", restaurantId: null },
      db: { query: { restaurants: { findFirst: async () => undefined } } },
    });
    await expect(c.context()).resolves.toMatchObject({ restaurantStatus: null });
  });

  it("returns null when restaurant row is missing", async () => {
    const c = makeCaller({
      user: { id: "u1", role: "admin", restaurantId: "r1" },
      db: { query: { restaurants: { findFirst: async () => undefined } } },
    });
    await expect(c.context()).resolves.toMatchObject({ restaurantStatus: null });
  });

  it("throws UNAUTHORIZED when no user", async () => {
    const c = makeCaller({ user: null, db: {} });
    await expect(c.context()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
