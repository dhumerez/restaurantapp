import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { Db } from "@restaurant/db";
import { user } from "@restaurant/db";
import { auth } from "../lib/auth.js";

export async function createStaff(
  db: Db,
  restaurantId: string,
  input: {
    name: string;
    email: string;
    role: "admin" | "waiter" | "kitchen" | "cashier";
    password: string;
  }
): Promise<typeof user.$inferSelect> {
  const existing = await db.query.user.findFirst({
    where: eq(user.email, input.email),
  });
  if (existing) throw new TRPCError({ code: "CONFLICT", message: "Email already in use" });

  // Better Auth creates both the user row and the hashed-password account row.
  try {
    await auth.api.signUpEmail({
      body: { email: input.email, password: input.password, name: input.name },
    });
  } catch (err: any) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: err?.message ?? "Failed to create staff account",
    });
  }

  // Patch the restaurant-specific fields that Better Auth's signUp doesn't know about.
  const [patched] = await db
    .update(user)
    .set({
      role: input.role,
      restaurantId,
      emailVerified: true,
      isActive: true,
      updatedAt: new Date(),
    })
    .where(eq(user.email, input.email))
    .returning();

  return patched;
}

export async function updateStaff(
  db: Db,
  restaurantId: string,
  userId: string,
  input: Partial<{ name: string; role: string; isActive: boolean }>
): Promise<typeof user.$inferSelect> {
  const [updated] = await db
    .update(user)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(user.id, userId), eq(user.restaurantId, restaurantId)))
    .returning();
  if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
  return updated;
}

export async function listStaff(
  db: Db,
  restaurantId: string
): Promise<Array<typeof user.$inferSelect>> {
  return db.query.user.findMany({
    where: and(eq(user.restaurantId, restaurantId)),
    orderBy: (u, { asc }) => [asc(u.name)],
  });
}
