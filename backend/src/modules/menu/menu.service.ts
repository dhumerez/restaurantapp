import { eq, and } from "drizzle-orm";
import { db } from "../../config/db.js";
import { categories, menuItems } from "../../db/schema.js";
import { NotFoundError } from "../../utils/errors.js";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateMenuItemInput,
  UpdateMenuItemInput,
} from "./menu.schema.js";

// ─── Categories ──────────────────────────────────────────────

export async function listCategories(restaurantId: string) {
  return db
    .select()
    .from(categories)
    .where(
      and(eq(categories.restaurantId, restaurantId), eq(categories.isActive, true))
    )
    .orderBy(categories.sortOrder);
}

export async function createCategory(restaurantId: string, input: CreateCategoryInput) {
  const [category] = await db
    .insert(categories)
    .values({ ...input, restaurantId })
    .returning();
  return category;
}

export async function updateCategory(
  restaurantId: string,
  id: string,
  input: UpdateCategoryInput
) {
  const [category] = await db
    .update(categories)
    .set(input)
    .where(and(eq(categories.id, id), eq(categories.restaurantId, restaurantId)))
    .returning();

  if (!category) throw new NotFoundError("Category not found");
  return category;
}

export async function deleteCategory(restaurantId: string, id: string) {
  const [category] = await db
    .update(categories)
    .set({ isActive: false })
    .where(and(eq(categories.id, id), eq(categories.restaurantId, restaurantId)))
    .returning();

  if (!category) throw new NotFoundError("Category not found");
  return category;
}

// ─── Menu Items ──────────────────────────────────────────────

export async function listMenuItems(restaurantId: string, categoryId?: string) {
  const conditions = [
    eq(menuItems.restaurantId, restaurantId),
    eq(menuItems.isAvailable, true),
  ];

  if (categoryId) {
    conditions.push(eq(menuItems.categoryId, categoryId));
  }

  return db
    .select()
    .from(menuItems)
    .where(and(...conditions))
    .orderBy(menuItems.sortOrder);
}

export async function createMenuItem(restaurantId: string, input: CreateMenuItemInput) {
  const [item] = await db
    .insert(menuItems)
    .values({
      ...input,
      restaurantId,
      price: input.price.toString(),
    })
    .returning();
  return item;
}

export async function updateMenuItem(
  restaurantId: string,
  id: string,
  input: UpdateMenuItemInput
) {
  const values: Record<string, unknown> = { ...input, updatedAt: new Date() };
  if (input.price !== undefined) {
    values.price = input.price.toString();
  }

  const [item] = await db
    .update(menuItems)
    .set(values)
    .where(and(eq(menuItems.id, id), eq(menuItems.restaurantId, restaurantId)))
    .returning();

  if (!item) throw new NotFoundError("Menu item not found");
  return item;
}

export async function deleteMenuItem(restaurantId: string, id: string) {
  const [item] = await db
    .update(menuItems)
    .set({ isAvailable: false, updatedAt: new Date() })
    .where(and(eq(menuItems.id, id), eq(menuItems.restaurantId, restaurantId)))
    .returning();

  if (!item) throw new NotFoundError("Menu item not found");
  return item;
}

export async function updateStock(
  restaurantId: string,
  id: string,
  stockCount: number | null
) {
  const [item] = await db
    .update(menuItems)
    .set({ stockCount, updatedAt: new Date() })
    .where(and(eq(menuItems.id, id), eq(menuItems.restaurantId, restaurantId)))
    .returning();

  if (!item) throw new NotFoundError("Menu item not found");
  return item;
}
