import { describe, it, expect, vi } from "vitest";
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";

const t = initTRPC.create();

const saMiddleware = t.middleware(({ ctx, next }) => {
  if ((ctx as any).user?.role !== "superadmin") throw new TRPCError({ code: "FORBIDDEN" });
  return next();
});

const build = (db: any) =>
  t.router({
    get: t.procedure.use(saMiddleware).query(async () => {
      const row = await db.query.platformSettings.findFirst();
      return { contactEmail: row?.contactEmail ?? "", contactPhone: row?.contactPhone ?? "" };
    }),
    update: t.procedure
      .use(saMiddleware)
      .input(z.object({ contactEmail: z.string().email().or(z.literal("")), contactPhone: z.string() }))
      .mutation(async ({ input }) => {
        await db.insertOrUpdate("singleton", input);
        return input;
      }),
  });

describe("superadmin.settings", () => {
  it("get returns the singleton row", async () => {
    const db = { query: { platformSettings: { findFirst: async () => ({ contactEmail: "x@y.z", contactPhone: "+1" }) } } };
    const c = build(db).createCaller({ user: { role: "superadmin" } } as any);
    await expect(c.get()).resolves.toEqual({ contactEmail: "x@y.z", contactPhone: "+1" });
  });

  it("get returns empty strings when singleton missing", async () => {
    const db = { query: { platformSettings: { findFirst: async () => undefined } } };
    const c = build(db).createCaller({ user: { role: "superadmin" } } as any);
    await expect(c.get()).resolves.toEqual({ contactEmail: "", contactPhone: "" });
  });

  it("get rejects non-superadmin", async () => {
    const db = { query: { platformSettings: { findFirst: async () => undefined } } };
    const c = build(db).createCaller({ user: { role: "admin" } } as any);
    await expect(c.get()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("update persists and returns new values", async () => {
    const insertOrUpdate = vi.fn(async () => {});
    const db = { query: { platformSettings: { findFirst: async () => undefined } }, insertOrUpdate };
    const c = build(db).createCaller({ user: { role: "superadmin" } } as any);
    await expect(c.update({ contactEmail: "a@b.co", contactPhone: "+1" })).resolves.toEqual({ contactEmail: "a@b.co", contactPhone: "+1" });
    expect(insertOrUpdate).toHaveBeenCalledWith("singleton", { contactEmail: "a@b.co", contactPhone: "+1" });
  });

  it("update rejects invalid email", async () => {
    const db = { query: { platformSettings: { findFirst: async () => undefined } }, insertOrUpdate: async () => {} };
    const c = build(db).createCaller({ user: { role: "superadmin" } } as any);
    await expect(c.update({ contactEmail: "not-an-email", contactPhone: "+1" } as any)).rejects.toThrow();
  });
});
