import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { env } from "../config/env.js";
import { db } from "../config/db.js";
import { restaurants, users, categories, menuItems, tables, orders, orderItems } from "../db/schema.js";
import type { JwtPayload } from "../middleware/auth.js";

export interface TestData {
  restaurantId: string;
  adminId: string;
  waiterId: string;
  kitchenId: string;
  categoryId: string;
  menuItemId: string;
  menuItemWithStockId: string;
  tableId: string;
  adminToken: string;
  waiterToken: string;
  kitchenToken: string;
}

function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "15m" });
}

export async function seedTestData(): Promise<TestData> {
  const ts = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // Create restaurant
  const [restaurant] = await db
    .insert(restaurants)
    .values({
      name: "Test Restaurant",
      slug: `test-${ts}`.slice(0, 100),
      currency: "USD",
      taxRate: "10.00",
    })
    .returning();

  const passwordHash = await bcrypt.hash("password123", 4); // low rounds for speed

  // Create users
  const [admin] = await db
    .insert(users)
    .values({
      restaurantId: restaurant.id,
      name: "Test Admin",
      email: `admin-${ts}@test.com`,
      passwordHash,
      role: "admin",
    })
    .returning();

  const [waiter] = await db
    .insert(users)
    .values({
      restaurantId: restaurant.id,
      name: "Test Waiter",
      email: `waiter-${ts}@test.com`,
      passwordHash,
      role: "waiter",
    })
    .returning();

  const [kitchen] = await db
    .insert(users)
    .values({
      restaurantId: restaurant.id,
      name: "Test Kitchen",
      email: `kitchen-${ts}@test.com`,
      passwordHash,
      role: "kitchen",
    })
    .returning();

  // Create category
  const [category] = await db
    .insert(categories)
    .values({
      restaurantId: restaurant.id,
      name: "Test Category",
      sortOrder: 0,
    })
    .returning();

  // Create menu items
  const [menuItem] = await db
    .insert(menuItems)
    .values({
      restaurantId: restaurant.id,
      categoryId: category.id,
      name: "Test Burger",
      price: "12.50",
      isAvailable: true,
    })
    .returning();

  const [menuItemWithStock] = await db
    .insert(menuItems)
    .values({
      restaurantId: restaurant.id,
      categoryId: category.id,
      name: "Limited Steak",
      price: "25.00",
      stockCount: 5,
      isAvailable: true,
    })
    .returning();

  // Create table
  const [table] = await db
    .insert(tables)
    .values({
      restaurantId: restaurant.id,
      number: 100 + Math.floor(Math.random() * 8900), // avoid conflicts
      seats: 4,
    })
    .returning();

  // Generate tokens
  const adminToken = generateToken({
    userId: admin.id,
    restaurantId: restaurant.id,
    role: "admin",
    scope: "restaurant",
  });

  const waiterToken = generateToken({
    userId: waiter.id,
    restaurantId: restaurant.id,
    role: "waiter",
    scope: "restaurant",
  });

  const kitchenToken = generateToken({
    userId: kitchen.id,
    restaurantId: restaurant.id,
    role: "kitchen",
    scope: "restaurant",
  });

  return {
    restaurantId: restaurant.id,
    adminId: admin.id,
    waiterId: waiter.id,
    kitchenId: kitchen.id,
    categoryId: category.id,
    menuItemId: menuItem.id,
    menuItemWithStockId: menuItemWithStock.id,
    tableId: table.id,
    adminToken,
    waiterToken,
    kitchenToken,
  };
}

export async function cleanupTestData(restaurantId: string) {
  // Delete in order respecting FK constraints
  const orderRows = await db.select({ id: orders.id }).from(orders).where(
    eq(orders.restaurantId, restaurantId)
  );
  for (const o of orderRows) {
    await db.delete(orderItems).where(eq(orderItems.orderId, o.id));
  }
  await db.delete(orders).where(eq(orders.restaurantId, restaurantId));
  await db.delete(menuItems).where(eq(menuItems.restaurantId, restaurantId));
  await db.delete(categories).where(eq(categories.restaurantId, restaurantId));
  await db.delete(tables).where(eq(tables.restaurantId, restaurantId));
  await db.delete(users).where(eq(users.restaurantId, restaurantId));
  await db.delete(restaurants).where(eq(restaurants.id, restaurantId));
}
