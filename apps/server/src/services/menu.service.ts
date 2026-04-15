import { eq, and, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { Db } from "@restaurant/db";
import { categories, menuItems } from "@restaurant/db";

export async function listCategories(db: Db, restaurantId: string) {
  return db.query.categories.findMany({
    where: and(eq(categories.restaurantId, restaurantId), eq(categories.isActive, true)),
    orderBy: (c, { asc }) => [asc(c.sortOrder)],
    with: { menuItems: true },
  });
}

export async function createCategory(
  db: Db,
  restaurantId: string,
  input: { name: string; sortOrder?: number }
) {
  const [created] = await db.insert(categories).values({
    restaurantId,
    name: input.name,
    sortOrder: input.sortOrder ?? 0,
  }).returning();
  return created;
}

export async function updateCategory(
  db: Db,
  restaurantId: string,
  id: string,
  input: Partial<{ name: string; sortOrder: number; isActive: boolean }>
) {
  const [updated] = await db
    .update(categories)
    .set(input)
    .where(and(eq(categories.id, id), eq(categories.restaurantId, restaurantId)))
    .returning();
  if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
  return updated;
}

export async function listMenuItems(db: Db, restaurantId: string) {
  return db.query.menuItems.findMany({
    where: eq(menuItems.restaurantId, restaurantId),
    orderBy: [asc(menuItems.categoryId), asc(menuItems.sortOrder)],
  });
}

export async function createMenuItem(
  db: Db,
  restaurantId: string,
  input: {
    categoryId: string;
    name: string;
    description?: string;
    price: string;
    sortOrder?: number;
    imageUrl?: string;
  }
) {
  const [created] = await db.insert(menuItems).values({
    restaurantId,
    ...input,
  }).returning();
  return created;
}

export async function updateMenuItem(
  db: Db,
  restaurantId: string,
  id: string,
  input: Partial<{
    name: string;
    description: string;
    price: string;
    isAvailable: boolean;
    sortOrder: number;
    imageUrl: string;
    categoryId: string;
  }>
) {
  const [updated] = await db
    .update(menuItems)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(menuItems.id, id), eq(menuItems.restaurantId, restaurantId)))
    .returning();
  if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
  return updated;
}

export async function deleteMenuItem(db: Db, restaurantId: string, id: string) {
  const [deleted] = await db
    .delete(menuItems)
    .where(and(eq(menuItems.id, id), eq(menuItems.restaurantId, restaurantId)))
    .returning();
  if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });
}

export async function uploadMenuItemImage(
  fileBuffer: Buffer,
  fileName: string,
  r2Config: {
    accountId: string;
    accessKey: string;
    secretKey: string;
    bucket: string;
    publicUrl: string;
  } | null
): Promise<string | null> {
  if (!r2Config) return null;
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${r2Config.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: r2Config.accessKey, secretAccessKey: r2Config.secretKey },
  });
  const key = `menu-items/${Date.now()}-${fileName}`;
  await client.send(new PutObjectCommand({
    Bucket: r2Config.bucket,
    Key: key,
    Body: fileBuffer,
    ContentType: "image/webp",
  }));
  return `${r2Config.publicUrl}/${key}`;
}
