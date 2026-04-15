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
