import { describe, it, expect } from "vitest";
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";

const t = initTRPC.create();

const saMw = t.middleware(({ ctx, next }) => {
  if ((ctx as any).user?.role !== "superadmin") throw new TRPCError({ code: "FORBIDDEN" });
  return next();
});

const build = (db: any) =>
  t.router({
    get: t.procedure.use(saMw).input(z.object({ id: z.string().uuid() })).query(async ({ input }) => {
      const restaurant = await db.getRestaurantById(input.id);
      if (!restaurant) throw new TRPCError({ code: "NOT_FOUND" });
      const [stats, staff] = await Promise.all([
        db.getStatsFor(input.id),
        db.getStaffFor(input.id),
      ]);
      return { restaurant, stats, staff };
    }),
  });

describe("superadmin.restaurants.get", () => {
  it("returns restaurant + stats + staff", async () => {
    const db = {
      getRestaurantById: async () => ({ id: "r1", name: "Demo" }),
      getStatsFor: async () => ({ staffCount: 4, tableCount: 10, menuItemCount: 10, orderCount30d: 5 }),
      getStaffFor: async () => [{ id: "u1", name: "A", email: "a@b.c", role: "admin", isActive: true, createdAt: new Date() }],
    };
    const c = build(db).createCaller({ user: { role: "superadmin" } } as any);
    const res = await c.get({ id: "00000000-0000-0000-0000-000000000001" } as any);
    expect(res.restaurant.id).toBe("r1");
    expect(res.stats.staffCount).toBe(4);
    expect(res.staff).toHaveLength(1);
  });

  it("throws NOT_FOUND for unknown id", async () => {
    const fixtureDb = {
      getRestaurantById: async () => undefined,
      getStatsFor: async () => ({ staffCount: 4, tableCount: 10, menuItemCount: 10, orderCount30d: 5 }),
      getStaffFor: async () => [],
    };
    const c = build(fixtureDb).createCaller({ user: { role: "superadmin" } } as any);
    await expect(c.get({ id: "00000000-0000-0000-0000-000000000000" } as any)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws FORBIDDEN for non-superadmin", async () => {
    const fixtureDb = {
      getRestaurantById: async () => ({ id: "r1", name: "Demo" }),
      getStatsFor: async () => ({ staffCount: 0, tableCount: 0, menuItemCount: 0, orderCount30d: 0 }),
      getStaffFor: async () => [],
    };
    const c = build(fixtureDb).createCaller({ user: { role: "admin" } } as any);
    await expect(c.get({ id: "00000000-0000-0000-0000-000000000001" } as any)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
