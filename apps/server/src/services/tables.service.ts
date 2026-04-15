import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { Db } from "@restaurant/db";
import { tables } from "@restaurant/db";

export async function listTables(db: Db, restaurantId: string) {
  return db.query.tables.findMany({
    where: and(eq(tables.restaurantId, restaurantId), eq(tables.isActive, true)),
    orderBy: (t, { asc }) => [asc(t.number)],
  });
}

export async function createTable(
  db: Db,
  restaurantId: string,
  input: { number: number; label?: string; seats?: number }
) {
  const [created] = await db.insert(tables).values({
    restaurantId,
    number: input.number,
    label: input.label,
    seats: input.seats ?? 4,
  }).returning();
  return created;
}

export async function updateTable(
  db: Db,
  restaurantId: string,
  id: string,
  input: Partial<{ label: string; seats: number; isActive: boolean }>
) {
  const [updated] = await db
    .update(tables)
    .set(input)
    .where(and(eq(tables.id, id), eq(tables.restaurantId, restaurantId)))
    .returning();
  if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
  return updated;
}

export async function deleteTable(db: Db, restaurantId: string, id: string) {
  return updateTable(db, restaurantId, id, { isActive: false });
}
