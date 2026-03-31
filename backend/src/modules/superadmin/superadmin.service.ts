import bcrypt from "bcrypt";
import { eq, sql, count } from "drizzle-orm";
import { db } from "../../config/db.js";
import { restaurants, users, orders } from "../../db/schema.js";
import { AppError, NotFoundError } from "../../utils/errors.js";
import type { createRestaurantSchema, updateRestaurantSchema } from "./superadmin.schema.js";
import type { z } from "zod";

export async function getPlatformStats() {
  const [restaurantCount] = await db
    .select({ count: count() })
    .from(restaurants);

  const [userCount] = await db
    .select({ count: count() })
    .from(users)
    .where(eq(users.isActive, true));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [orderStats] = await db
    .select({
      count: count(),
      revenue: sql<string>`COALESCE(SUM(${orders.total}), '0.00')`,
    })
    .from(orders)
    .where(sql`${orders.createdAt} >= ${today}`);

  return {
    totalRestaurants: restaurantCount.count,
    activeUsers: userCount.count,
    todayOrders: orderStats.count,
    todayRevenue: orderStats.revenue,
  };
}

export async function listRestaurants() {
  const result = await db
    .select({
      id: restaurants.id,
      name: restaurants.name,
      slug: restaurants.slug,
      address: restaurants.address,
      currency: restaurants.currency,
      taxRate: restaurants.taxRate,
      status: restaurants.status,
      createdAt: restaurants.createdAt,
      userCount: sql<number>`(SELECT COUNT(*) FROM users WHERE users.restaurant_id = ${restaurants.id})::int`,
    })
    .from(restaurants)
    .orderBy(restaurants.createdAt);

  return result;
}

export async function getRestaurant(id: string) {
  const [restaurant] = await db
    .select()
    .from(restaurants)
    .where(eq(restaurants.id, id));

  if (!restaurant) {
    throw new NotFoundError("Restaurant not found");
  }

  const [stats] = await db
    .select({
      userCount: count(),
    })
    .from(users)
    .where(eq(users.restaurantId, id));

  const [orderStats] = await db
    .select({
      totalOrders: count(),
      totalRevenue: sql<string>`COALESCE(SUM(${orders.total}), '0.00')`,
    })
    .from(orders)
    .where(eq(orders.restaurantId, id));

  return {
    ...restaurant,
    userCount: stats.userCount,
    totalOrders: orderStats.totalOrders,
    totalRevenue: orderStats.totalRevenue,
  };
}

export async function createRestaurant(input: z.infer<typeof createRestaurantSchema>) {
  // Check slug uniqueness
  const [existing] = await db
    .select({ id: restaurants.id })
    .from(restaurants)
    .where(eq(restaurants.slug, input.slug));

  if (existing) {
    throw new AppError(409, "A restaurant with this slug already exists");
  }

  const passwordHash = await bcrypt.hash(input.adminPassword, 12);

  // Transactional: create restaurant + admin user
  const result = await db.transaction(async (tx) => {
    const [restaurant] = await tx
      .insert(restaurants)
      .values({
        name: input.name,
        slug: input.slug,
        address: input.address,
        currency: input.currency,
        taxRate: input.taxRate,
      })
      .returning();

    const [admin] = await tx
      .insert(users)
      .values({
        restaurantId: restaurant.id,
        name: input.adminName,
        email: input.adminEmail,
        passwordHash,
        role: "admin",
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
      });

    return { restaurant, admin };
  });

  return result;
}

export async function updateRestaurant(id: string, input: z.infer<typeof updateRestaurantSchema>) {
  const [updated] = await db
    .update(restaurants)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(restaurants.id, id))
    .returning();

  if (!updated) {
    throw new NotFoundError("Restaurant not found");
  }

  return updated;
}

export async function listRestaurantUsers(restaurantId: string) {
  const [restaurant] = await db
    .select({ id: restaurants.id })
    .from(restaurants)
    .where(eq(restaurants.id, restaurantId));

  if (!restaurant) {
    throw new NotFoundError("Restaurant not found");
  }

  const staffList = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.restaurantId, restaurantId));

  return staffList;
}
