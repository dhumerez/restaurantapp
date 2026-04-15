import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { Db } from "@restaurant/db";
import { user } from "@restaurant/db";

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

  const now = new Date();
  const [created] = await db.insert(user).values({
    id: crypto.randomUUID(),
    name: input.name,
    email: input.email,
    emailVerified: true, // ALWAYS true — staff don't go through email verification
    role: input.role,
    restaurantId,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }).returning();

  // NOTE: password hash must be stored via Better Auth's account table
  return created;
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
