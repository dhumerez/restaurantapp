import { describe, it, expect } from "vitest";
import { initTRPC, TRPCError } from "@trpc/server";

type MockUser = {
  role: string | null;
  restaurantId: string | null;
  isActive: boolean;
} | null;

const makeCtx = (overrides: {
  user?: MockUser;
  session?: object | null;
} = {}) => ({
  db: {} as any,
  req: {} as any,
  res: {} as any,
  session: overrides.session !== undefined ? overrides.session : null,
  user: overrides.user !== undefined ? overrides.user : null,
});

// Re-implement the middleware logic for isolated testing
const t = initTRPC.context<ReturnType<typeof makeCtx>>().create();

const protectedMiddleware = t.middleware(({ ctx, next }) => {
  if (!ctx.user || !ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, user: ctx.user, session: ctx.session } });
});

const restaurantMiddleware = protectedMiddleware.unstable_pipe(({ ctx, next }) => {
  const user = ctx.user as NonNullable<MockUser>;
  if (!user.restaurantId || !user.role) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No restaurant assigned" });
  }
  if (!user.isActive) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Account deactivated" });
  }
  return next({ ctx: { ...ctx, restaurantId: user.restaurantId, role: user.role } });
});

const testRouter = t.router({
  protected: t.procedure.use(protectedMiddleware).query(() => "ok"),
  restaurant: t.procedure.use(restaurantMiddleware).query(() => "ok"),
});

const caller = testRouter.createCaller;

describe("protectedProcedure", () => {
  it("throws UNAUTHORIZED when no user", async () => {
    const c = caller(makeCtx());
    await expect(c.protected()).rejects.toThrow(TRPCError);
    await expect(c.protected()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("passes when user and session are present", async () => {
    const c = caller(makeCtx({
      user: { role: "admin", restaurantId: "r1", isActive: true },
      session: { id: "s1" },
    }));
    await expect(c.protected()).resolves.toBe("ok");
  });
});

describe("restaurantProcedure", () => {
  it("throws FORBIDDEN when user has no restaurantId", async () => {
    const c = caller(makeCtx({
      user: { role: "waiter", restaurantId: null, isActive: true },
      session: { id: "s1" },
    }));
    await expect(c.restaurant()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws FORBIDDEN when user isActive=false", async () => {
    const c = caller(makeCtx({
      user: { role: "waiter", restaurantId: "r1", isActive: false },
      session: { id: "s1" },
    }));
    await expect(c.restaurant()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("passes when user has restaurantId, role, isActive=true", async () => {
    const c = caller(makeCtx({
      user: { role: "waiter", restaurantId: "r1", isActive: true },
      session: { id: "s1" },
    }));
    await expect(c.restaurant()).resolves.toBe("ok");
  });
});

describe("restaurantProcedure status allow-list", () => {
  const makeDbWithStatus = (status: string | undefined) => ({
    query: {
      restaurants: {
        findFirst: async () => (status === undefined ? undefined : { id: "r1", status }),
      },
    },
  });

  const caseFor = async (status: string | undefined, shouldPass: boolean) => {
    const t2 = initTRPC.context<ReturnType<typeof makeCtx>>().create();
    const mw = t2.middleware(async ({ ctx, next }) => {
      if (!ctx.user || !ctx.session) throw new TRPCError({ code: "UNAUTHORIZED" });
      const u = ctx.user as NonNullable<MockUser>;
      if (!u.restaurantId || !u.role) throw new TRPCError({ code: "FORBIDDEN", message: "No restaurant assigned" });
      if (!u.isActive) throw new TRPCError({ code: "FORBIDDEN", message: "Account deactivated" });
      const ALLOWED = new Set(["active", "trial", "demo"]);
      const r = await (ctx.db as any).query.restaurants.findFirst();
      if (!r || !ALLOWED.has(r.status)) throw new TRPCError({ code: "FORBIDDEN", message: "RESTAURANT_INACTIVE" });
      return next({ ctx: { ...ctx, restaurantId: u.restaurantId, role: u.role, restaurant: r } });
    });
    const r = t2.router({ q: t2.procedure.use(mw).query(({ ctx }) => (ctx as any).restaurant?.id ?? null) });
    const c = r.createCaller({
      db: makeDbWithStatus(status) as any,
      req: {} as any,
      res: {} as any,
      session: { id: "s1" },
      user: { role: "admin", restaurantId: "r1", isActive: true },
    });
    if (shouldPass) {
      await expect(c.q()).resolves.toBe("r1");
    } else {
      await expect(c.q()).rejects.toMatchObject({ code: "FORBIDDEN", message: "RESTAURANT_INACTIVE" });
    }
  };

  it("allows active", () => caseFor("active", true));
  it("allows trial", () => caseFor("trial", true));
  it("allows demo", () => caseFor("demo", true));
  it("blocks inactive", () => caseFor("inactive", false));
  it("blocks suspended", () => caseFor("suspended", false));
  it("blocks missing restaurant row", () => caseFor(undefined, false));
});
