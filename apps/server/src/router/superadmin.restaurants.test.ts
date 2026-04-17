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

const buildUpdate = (db: any) =>
  t.router({
    update: t.procedure.use(saMw)
      .input(z.object({
        id: z.string().uuid(),
        status: z.enum(["active", "trial", "suspended", "inactive"]).optional(),
        name: z.string().min(1).optional(),
        taxRate: z.string().optional(),
        subscriptionTier: z.enum(["free", "subscribed", "allaccess"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const updated = await db.updateRestaurant(id, data);
        if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
        return updated;
      }),
  });

describe("superadmin.restaurants.update", () => {
  it("passes subscriptionTier to the persistence layer", async () => {
    const calls: Array<{ id: string; data: any }> = [];
    const db = {
      updateRestaurant: async (id: string, data: any) => {
        calls.push({ id, data });
        return { id, ...data };
      },
    };
    const c = buildUpdate(db).createCaller({ user: { role: "superadmin" } } as any);
    const res = await c.update({ id: "00000000-0000-0000-0000-000000000001", subscriptionTier: "allaccess" });
    expect(calls).toHaveLength(1);
    expect(calls[0].data.subscriptionTier).toBe("allaccess");
    expect(res.subscriptionTier).toBe("allaccess");
  });

  it("accepts all three valid subscriptionTier enum values", async () => {
    const db = { updateRestaurant: async (id: string, data: any) => ({ id, ...data }) };
    const c = buildUpdate(db).createCaller({ user: { role: "superadmin" } } as any);
    for (const tier of ["free", "subscribed", "allaccess"] as const) {
      const res = await c.update({ id: "00000000-0000-0000-0000-000000000001", subscriptionTier: tier });
      expect(res.subscriptionTier).toBe(tier);
    }
  });

  it("rejects an invalid subscriptionTier value", async () => {
    const db = { updateRestaurant: async (id: string, data: any) => ({ id, ...data }) };
    const c = buildUpdate(db).createCaller({ user: { role: "superadmin" } } as any);
    await expect(
      c.update({ id: "00000000-0000-0000-0000-000000000001", subscriptionTier: "pro" } as any)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws FORBIDDEN for non-superadmin", async () => {
    const db = { updateRestaurant: async (id: string, data: any) => ({ id, ...data }) };
    const c = buildUpdate(db).createCaller({ user: { role: "admin" } } as any);
    await expect(
      c.update({ id: "00000000-0000-0000-0000-000000000001", subscriptionTier: "free" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
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
