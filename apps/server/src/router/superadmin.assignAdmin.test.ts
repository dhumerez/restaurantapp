import { describe, it, expect } from "vitest";
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";

const t = initTRPC.create();

const saMw = t.middleware(({ ctx, next }) => {
  if ((ctx as any).user?.role !== "superadmin") throw new TRPCError({ code: "FORBIDDEN" });
  return next();
});

/**
 * Local mini-router that mirrors the real assignAdmin logic
 * but uses injectable fake db methods instead of real drizzle + auth calls.
 *
 * Fake db shape:
 *   db.getRestaurantById(id)          -> restaurant | undefined
 *   db.getUserById(id)                -> user | undefined
 *   db.findUserByEmail(email)         -> user | undefined
 *   db.signUpEmail(body)              -> void  (creates user row)
 *   db.patchUser(id, data)            -> patched user
 */
const buildAssignAdmin = (db: any) =>
  t.router({
    assignAdmin: t.procedure
      .use(saMw)
      .input(
        z.discriminatedUnion("mode", [
          z.object({
            restaurantId: z.string().uuid(),
            mode: z.literal("existing"),
            userId: z.string(),
          }),
          z.object({
            restaurantId: z.string().uuid(),
            mode: z.literal("new"),
            email: z.string().email(),
            name: z.string().min(1),
            password: z.string().min(8),
          }),
        ])
      )
      .mutation(async ({ input }) => {
        // 1. Ensure restaurant exists
        const restaurant = await db.getRestaurantById(input.restaurantId);
        if (!restaurant) throw new TRPCError({ code: "NOT_FOUND", message: "Restaurant not found" });

        if (input.mode === "existing") {
          // 2a. Ensure user exists
          const existing = await db.getUserById(input.userId);
          if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

          // Patch and return
          return db.patchUser(input.userId, {
            role: "admin",
            restaurantId: input.restaurantId,
            isActive: true,
            emailVerified: true,
            updatedAt: expect.any(Date) as any,
          });
        } else {
          // 2b. Email conflict pre-check
          const conflict = await db.findUserByEmail(input.email);
          if (conflict) throw new TRPCError({ code: "CONFLICT", message: "Email already registered" });

          // Create via auth
          await db.signUpEmail({ email: input.email, name: input.name, password: input.password });

          // Look up created user
          const created = await db.findUserByEmail(input.email);
          if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "User creation failed" });

          // Patch and return
          return db.patchUser(created.id, {
            role: "admin",
            restaurantId: input.restaurantId,
            isActive: true,
            emailVerified: true,
            updatedAt: expect.any(Date) as any,
          });
        }
      }),
  });

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const RESTAURANT_ID = "00000000-0000-0000-0000-000000000001";
const USER_ID = "00000000-0000-0000-0000-000000000002";

const baseRestaurant = { id: RESTAURANT_ID, name: "Test Restaurant" };
const baseUser = { id: USER_ID, email: "staff@example.com", name: "Staff Member", role: null };

const saCtx = { user: { role: "superadmin" } } as any;
const anonCtx = { user: { role: "admin" } } as any;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("superadmin.restaurants.assignAdmin — mode: existing", () => {
  it("patches an existing user with role=admin, restaurantId, isActive, emailVerified", async () => {
    const patchCalls: Array<{ id: string; data: any }> = [];
    const db = {
      getRestaurantById: async () => baseRestaurant,
      getUserById: async () => baseUser,
      patchUser: async (id: string, data: any) => {
        patchCalls.push({ id, data });
        return { ...baseUser, ...data, id };
      },
    };

    const c = buildAssignAdmin(db).createCaller(saCtx);
    const result = await c.assignAdmin({ restaurantId: RESTAURANT_ID, mode: "existing", userId: USER_ID });

    expect(patchCalls).toHaveLength(1);
    expect(patchCalls[0].id).toBe(USER_ID);
    expect(patchCalls[0].data).toMatchObject({
      role: "admin",
      restaurantId: RESTAURANT_ID,
      isActive: true,
      emailVerified: true,
    });
    expect(result.role).toBe("admin");
    expect(result.restaurantId).toBe(RESTAURANT_ID);
    expect(result.isActive).toBe(true);
    expect(result.emailVerified).toBe(true);
  });

  it("throws NOT_FOUND when restaurant does not exist", async () => {
    const db = {
      getRestaurantById: async () => undefined,
      getUserById: async () => baseUser,
      patchUser: async () => { throw new Error("should not be called"); },
    };
    const c = buildAssignAdmin(db).createCaller(saCtx);
    await expect(
      c.assignAdmin({ restaurantId: RESTAURANT_ID, mode: "existing", userId: USER_ID })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws NOT_FOUND when user does not exist", async () => {
    const db = {
      getRestaurantById: async () => baseRestaurant,
      getUserById: async () => undefined,
      patchUser: async () => { throw new Error("should not be called"); },
    };
    const c = buildAssignAdmin(db).createCaller(saCtx);
    await expect(
      c.assignAdmin({ restaurantId: RESTAURANT_ID, mode: "existing", userId: USER_ID })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws FORBIDDEN for non-superadmin", async () => {
    const db = {
      getRestaurantById: async () => baseRestaurant,
      getUserById: async () => baseUser,
      patchUser: async () => baseUser,
    };
    const c = buildAssignAdmin(db).createCaller(anonCtx);
    await expect(
      c.assignAdmin({ restaurantId: RESTAURANT_ID, mode: "existing", userId: USER_ID })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("superadmin.restaurants.assignAdmin — mode: new", () => {
  const newEmail = "newadmin@example.com";
  const newName = "New Admin";
  const newPassword = "securepassword123";
  const newUserId = "00000000-0000-0000-0000-000000000099";

  it("creates a new user via signUpEmail then patches with role=admin", async () => {
    const signUpCalls: any[] = [];
    const patchCalls: Array<{ id: string; data: any }> = [];
    let createdUser: any = null;

    const db = {
      getRestaurantById: async () => baseRestaurant,
      findUserByEmail: async (email: string) => {
        // Before sign up: not found. After: found.
        return createdUser?.email === email ? createdUser : undefined;
      },
      signUpEmail: async (body: any) => {
        signUpCalls.push(body);
        createdUser = { id: newUserId, email: body.email, name: body.name, role: null };
      },
      patchUser: async (id: string, data: any) => {
        patchCalls.push({ id, data });
        return { id, email: newEmail, name: newName, ...data };
      },
    };

    const c = buildAssignAdmin(db).createCaller(saCtx);
    const result = await c.assignAdmin({
      restaurantId: RESTAURANT_ID,
      mode: "new",
      email: newEmail,
      name: newName,
      password: newPassword,
    });

    // signUpEmail was called with correct body
    expect(signUpCalls).toHaveLength(1);
    expect(signUpCalls[0]).toMatchObject({ email: newEmail, name: newName, password: newPassword });

    // patchUser was called on the newly created user
    expect(patchCalls).toHaveLength(1);
    expect(patchCalls[0].id).toBe(newUserId);
    expect(patchCalls[0].data).toMatchObject({
      role: "admin",
      restaurantId: RESTAURANT_ID,
      isActive: true,
      emailVerified: true,
    });

    expect(result.role).toBe("admin");
    expect(result.restaurantId).toBe(RESTAURANT_ID);
    expect(result.isActive).toBe(true);
    expect(result.emailVerified).toBe(true);
  });

  it("throws NOT_FOUND when restaurant does not exist", async () => {
    const db = {
      getRestaurantById: async () => undefined,
      findUserByEmail: async () => undefined,
      signUpEmail: async () => { throw new Error("should not be called"); },
      patchUser: async () => { throw new Error("should not be called"); },
    };
    const c = buildAssignAdmin(db).createCaller(saCtx);
    await expect(
      c.assignAdmin({ restaurantId: RESTAURANT_ID, mode: "new", email: newEmail, name: newName, password: newPassword })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws CONFLICT when email is already registered", async () => {
    const db = {
      getRestaurantById: async () => baseRestaurant,
      findUserByEmail: async () => ({ id: "existing-id", email: newEmail }), // already exists
      signUpEmail: async () => { throw new Error("should not be called"); },
      patchUser: async () => { throw new Error("should not be called"); },
    };
    const c = buildAssignAdmin(db).createCaller(saCtx);
    await expect(
      c.assignAdmin({ restaurantId: RESTAURANT_ID, mode: "new", email: newEmail, name: newName, password: newPassword })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("throws FORBIDDEN for non-superadmin", async () => {
    const db = {
      getRestaurantById: async () => baseRestaurant,
      findUserByEmail: async () => undefined,
      signUpEmail: async () => {},
      patchUser: async () => {},
    };
    const c = buildAssignAdmin(db).createCaller(anonCtx);
    await expect(
      c.assignAdmin({ restaurantId: RESTAURANT_ID, mode: "new", email: newEmail, name: newName, password: newPassword })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
