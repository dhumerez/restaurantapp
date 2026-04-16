import { describe, it, expect } from "vitest";
import { initTRPC } from "@trpc/server";

const t = initTRPC.create();

const makeCaller = (ctx: any) => {
  const r = t.router({
    publicContact: t.procedure.query(async (opts: any) => {
      const s = await opts.ctx.db.query.platformSettings.findFirst();
      return { contactEmail: s?.contactEmail ?? "", contactPhone: s?.contactPhone ?? "" };
    }),
  });
  return r.createCaller(ctx);
};

describe("platform.publicContact", () => {
  it("returns configured contact info", async () => {
    const c = makeCaller({
      db: { query: { platformSettings: { findFirst: async () => ({ contactEmail: "a@b.c", contactPhone: "+1" }) } } },
    });
    await expect(c.publicContact()).resolves.toEqual({ contactEmail: "a@b.c", contactPhone: "+1" });
  });

  it("returns empty strings when singleton missing", async () => {
    const c = makeCaller({ db: { query: { platformSettings: { findFirst: async () => undefined } } } });
    await expect(c.publicContact()).resolves.toEqual({ contactEmail: "", contactPhone: "" });
  });
});
