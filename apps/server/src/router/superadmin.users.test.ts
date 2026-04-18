import { describe, it, expect } from "vitest";
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";

const t = initTRPC.create();

const saMw = t.middleware(({ ctx, next }) => {
  if ((ctx as any).user?.role !== "superadmin") throw new TRPCError({ code: "FORBIDDEN" });
  return next();
});

/**
 * Local mini-router that mirrors the real users.list + users.create logic
 * but uses injectable fake db methods instead of real drizzle + auth calls.
 *
 * Fake db shape:
 *   db.listUsersWithRestaurant()          -> UserWithRestaurant[]
 *   db.findUserByEmail(email)             -> user | undefined
 *   db.signUpEmail(body)                  -> void  (creates user row)
 *   db.updateUser(id, data)               -> patched user
 */
const buildUsers = (db: any) =>
  t.router({
    list: t.procedure.use(saMw).query(async () => {
      const rows = await db.listUsersWithRestaurant();
      return rows.map((row: any) => {
        const { restaurantId, restaurantName, restaurantSlug, restaurantStatus, restaurantTier, ...userFields } = row;
        return {
          ...userFields,
          restaurant: restaurantId
            ? { id: restaurantId, name: restaurantName, slug: restaurantSlug, status: restaurantStatus, subscriptionTier: restaurantTier }
            : null,
        };
      });
    }),
    create: t.procedure
      .use(saMw)
      .input(
        z.object({
          email: z.string().email(),
          name: z.string().min(1),
          password: z.string().min(8),
          role: z.enum(["admin", "waiter", "kitchen", "cashier", "superadmin"]).optional(),
          restaurantId: z.string().uuid().optional(),
        })
      )
      .mutation(async ({ input }) => {
        // Email conflict pre-check
        const conflict = await db.findUserByEmail(input.email);
        if (conflict) throw new TRPCError({ code: "CONFLICT", message: "Email already registered" });

        // Create via Better Auth
        await db.signUpEmail({ email: input.email, name: input.name, password: input.password });

        // Look up the created user
        const created = await db.findUserByEmail(input.email);
        if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "User creation failed" });

        // If role is provided, patch the user
        if (input.role !== undefined) {
          const patch: Record<string, any> = {
            role: input.role,
            isActive: true,
            emailVerified: true,
            updatedAt: new Date(),
          };
          // For non-superadmin roles, include restaurantId if provided
          if (input.role !== "superadmin" && input.restaurantId !== undefined) {
            patch.restaurantId = input.restaurantId;
          }
          return db.updateUser(created.id, patch);
        }

        // No role provided: return the pending user as-is
        return created;
      }),
  });

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const RESTAURANT_ID = "00000000-0000-0000-0000-000000000001";
const USER_ID = "00000000-0000-0000-0000-000000000002";
const PENDING_USER_ID = "00000000-0000-0000-0000-000000000003";
const NEW_USER_ID = "00000000-0000-0000-0000-000000000099";

const baseRestaurant = {
  id: RESTAURANT_ID,
  name: "Test Restaurant",
  slug: "test-restaurant",
  status: "active",
  subscriptionTier: "free",
};

const saCtx = { user: { role: "superadmin" } } as any;
const anonCtx = { user: { role: "admin" } } as any;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("superadmin.users.list", () => {
  it("returns users with joined restaurant shape, null for pending users", async () => {
    const db = {
      listUsersWithRestaurant: async () => [
        {
          id: USER_ID,
          name: "Admin User",
          email: "admin@example.com",
          role: "admin",
          isActive: true,
          createdAt: new Date("2024-01-01"),
          restaurantId: RESTAURANT_ID,
          restaurantName: baseRestaurant.name,
          restaurantSlug: baseRestaurant.slug,
          restaurantStatus: baseRestaurant.status,
          restaurantTier: baseRestaurant.subscriptionTier,
        },
        {
          id: PENDING_USER_ID,
          name: "Pending User",
          email: "pending@example.com",
          role: null,
          isActive: false,
          createdAt: new Date("2024-01-02"),
          restaurantId: null,
          restaurantName: null,
          restaurantSlug: null,
          restaurantStatus: null,
          restaurantTier: null,
        },
      ],
    };

    const c = buildUsers(db).createCaller(saCtx);
    const result = await c.list();

    expect(result).toHaveLength(2);

    // User with restaurant
    expect(result[0].id).toBe(USER_ID);
    expect(result[0].restaurant).toEqual({
      id: RESTAURANT_ID,
      name: "Test Restaurant",
      slug: "test-restaurant",
      status: "active",
      subscriptionTier: "free",
    });

    // Pending user without restaurant
    expect(result[1].id).toBe(PENDING_USER_ID);
    expect(result[1].restaurant).toBeNull();
    expect(result[1].role).toBeNull();
  });

  it("throws FORBIDDEN for non-superadmin", async () => {
    const db = { listUsersWithRestaurant: async () => [] };
    const c = buildUsers(db).createCaller(anonCtx);
    await expect(c.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("superadmin.users.create — with role + restaurantId", () => {
  const email = "newadmin@example.com";
  const name = "New Admin";
  const password = "securepassword123";

  it("creates user via signUpEmail then patches with role + restaurantId", async () => {
    const signUpCalls: any[] = [];
    const updateCalls: Array<{ id: string; data: any }> = [];
    let createdUser: any = null;

    const db = {
      findUserByEmail: async (e: string) => (createdUser?.email === e ? createdUser : undefined),
      signUpEmail: async (body: any) => {
        signUpCalls.push(body);
        createdUser = { id: NEW_USER_ID, email: body.email, name: body.name, role: null, isActive: false };
      },
      updateUser: async (id: string, data: any) => {
        updateCalls.push({ id, data });
        return { id, email, name, ...data };
      },
    };

    const c = buildUsers(db).createCaller(saCtx);
    const result = await c.create({ email, name, password, role: "admin", restaurantId: RESTAURANT_ID });

    expect(signUpCalls).toHaveLength(1);
    expect(signUpCalls[0]).toMatchObject({ email, name, password });

    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].id).toBe(NEW_USER_ID);
    expect(updateCalls[0].data).toMatchObject({
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

  it("throws FORBIDDEN for non-superadmin", async () => {
    const db = {
      findUserByEmail: async () => undefined,
      signUpEmail: async () => {},
      updateUser: async () => {},
    };
    const c = buildUsers(db).createCaller(anonCtx);
    await expect(
      c.create({ email, name, password, role: "admin", restaurantId: RESTAURANT_ID })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("superadmin.users.create — without role (pending user)", () => {
  const email = "pending2@example.com";
  const name = "Pending Two";
  const password = "securepassword123";

  it("creates user without patching — returns pending user with role=null", async () => {
    const signUpCalls: any[] = [];
    const updateCalls: any[] = [];
    let createdUser: any = null;

    const db = {
      findUserByEmail: async (e: string) => (createdUser?.email === e ? createdUser : undefined),
      signUpEmail: async (body: any) => {
        signUpCalls.push(body);
        createdUser = { id: NEW_USER_ID, email: body.email, name: body.name, role: null, isActive: false };
      },
      updateUser: async (id: string, data: any) => {
        updateCalls.push({ id, data });
        return { id, ...data };
      },
    };

    const c = buildUsers(db).createCaller(saCtx);
    const result = await c.create({ email, name, password });

    expect(signUpCalls).toHaveLength(1);
    // updateUser should NOT have been called
    expect(updateCalls).toHaveLength(0);

    expect(result.id).toBe(NEW_USER_ID);
    expect(result.role).toBeNull();
    expect(result.isActive).toBe(false);
  });
});

describe("superadmin.users.create — duplicate email", () => {
  const email = "existing@example.com";
  const name = "Existing";
  const password = "securepassword123";

  it("throws CONFLICT when email is already registered", async () => {
    const db = {
      findUserByEmail: async () => ({ id: "some-id", email }), // already exists
      signUpEmail: async () => { throw new Error("should not be called"); },
      updateUser: async () => { throw new Error("should not be called"); },
    };

    const c = buildUsers(db).createCaller(saCtx);
    await expect(c.create({ email, name, password })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
