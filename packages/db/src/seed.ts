import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  restaurants, categories, menuItems, tables, orders, orderItems,
  ingredients, recipeItems, user, account,
} from "./schema.js";
import * as schema from "./schema.js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool, { schema });

// Restaurant
const [restaurant] = await db.insert(restaurants).values({
  name: "Demo Restaurant",
  slug: "demo",
  address: "123 Main Street",
  currency: "USD",
  taxRate: "10.00",
  status: "demo",
}).returning();

// Users (Better Auth user table — passwords handled separately via auth.api)
const now = new Date();
const [adminUser] = await db.insert(user).values({
  id: crypto.randomUUID(),
  name: "Admin User",
  email: "admin@demo.com",
  emailVerified: true,
  role: "admin",
  restaurantId: restaurant.id,
  isActive: true,
  createdAt: now,
  updatedAt: now,
}).returning();

const [waiter1] = await db.insert(user).values({
  id: crypto.randomUUID(),
  name: "Maria Waiter",
  email: "maria@demo.com",
  emailVerified: true,
  role: "waiter",
  restaurantId: restaurant.id,
  isActive: true,
  createdAt: now,
  updatedAt: now,
}).returning();

const [waiter2] = await db.insert(user).values({
  id: crypto.randomUUID(),
  name: "Carlos Waiter",
  email: "carlos@demo.com",
  emailVerified: true,
  role: "waiter",
  restaurantId: restaurant.id,
  isActive: true,
  createdAt: now,
  updatedAt: now,
}).returning();

const [kitchenUser] = await db.insert(user).values({
  id: crypto.randomUUID(),
  name: "Chef Kitchen",
  email: "kitchen@demo.com",
  emailVerified: true,
  role: "kitchen",
  restaurantId: restaurant.id,
  isActive: true,
  createdAt: now,
  updatedAt: now,
}).returning();

const [cashierUser] = await db.insert(user).values({
  id: crypto.randomUUID(),
  name: "Ana Cashier",
  email: "cashier@demo.com",
  emailVerified: true,
  role: "cashier",
  restaurantId: restaurant.id,
  isActive: true,
  createdAt: now,
  updatedAt: now,
}).returning();

// Categories
const [catEntradas, catPrincipales, catBebidas] = await db.insert(categories).values([
  { restaurantId: restaurant.id, name: "Entradas", sortOrder: 0 },
  { restaurantId: restaurant.id, name: "Platos Principales", sortOrder: 1 },
  { restaurantId: restaurant.id, name: "Bebidas", sortOrder: 2 },
]).returning();

// Menu Items
const menuRows = await db.insert(menuItems).values([
  { restaurantId: restaurant.id, categoryId: catEntradas.id, name: "Ceviche", description: "Fresco ceviche de mariscos", price: "12.50", sortOrder: 0 },
  { restaurantId: restaurant.id, categoryId: catEntradas.id, name: "Empanadas", description: "Empanadas de carne (x3)", price: "8.00", sortOrder: 1 },
  { restaurantId: restaurant.id, categoryId: catEntradas.id, name: "Ensalada César", description: "Lechuga romana, crutones, parmesano", price: "9.50", sortOrder: 2 },
  { restaurantId: restaurant.id, categoryId: catPrincipales.id, name: "Pollo a la Plancha", description: "Pechuga de pollo con papas y ensalada", price: "18.00", sortOrder: 0 },
  { restaurantId: restaurant.id, categoryId: catPrincipales.id, name: "Milanesa de Pollo", description: "Milanesa empanizada con arroz", price: "16.50", sortOrder: 1 },
  { restaurantId: restaurant.id, categoryId: catPrincipales.id, name: "Pasta Alfredo", description: "Fettuccine en salsa cremosa", price: "15.00", sortOrder: 2 },
  { restaurantId: restaurant.id, categoryId: catPrincipales.id, name: "Lomo Saltado", description: "Clásico lomo saltado peruano", price: "22.00", sortOrder: 3 },
  { restaurantId: restaurant.id, categoryId: catBebidas.id, name: "Coca-Cola", description: "Lata 355ml", price: "3.50", sortOrder: 0 },
  { restaurantId: restaurant.id, categoryId: catBebidas.id, name: "Agua Mineral", description: "Botella 500ml", price: "2.50", sortOrder: 1 },
  { restaurantId: restaurant.id, categoryId: catBebidas.id, name: "Jugo Natural", description: "Naranja o maracuyá", price: "5.00", sortOrder: 2 },
]).returning();

const [, , , polloItem, milanesaItem, , , cocaItem] = menuRows;

// Ingredients
const [ingPollo, , , ingCoca] = await db.insert(ingredients).values([
  { restaurantId: restaurant.id, name: "Pollo", unit: "kg", currentStock: "5.000", minStock: "1.000", costPerUnit: "4.5000" },
  { restaurantId: restaurant.id, name: "Harina", unit: "kg", currentStock: "3.000", minStock: "0.500", costPerUnit: "1.2000" },
  { restaurantId: restaurant.id, name: "Aceite", unit: "L", currentStock: "2.000", minStock: "0.500", costPerUnit: "2.8000" },
  { restaurantId: restaurant.id, name: "Coca-Cola", unit: "units", currentStock: "24.000", minStock: "6.000", costPerUnit: "1.5000" },
]).returning();

// Recipe items
await db.insert(recipeItems).values([
  { menuItemId: polloItem.id, ingredientId: ingPollo.id, quantity: "0.300" },
  { menuItemId: milanesaItem.id, ingredientId: ingPollo.id, quantity: "0.250" },
  { menuItemId: cocaItem.id, ingredientId: ingCoca.id, quantity: "1.000" },
]);

// Tables
await db.insert(tables).values(
  Array.from({ length: 10 }, (_, i) => ({
    restaurantId: restaurant.id,
    number: i + 1,
    label: `Mesa ${i + 1}`,
    seats: 4,
  }))
);

const allTables = await db.query.tables.findMany({
  where: (t, { eq }) => eq(t.restaurantId, restaurant.id),
  orderBy: (t, { asc }) => [asc(t.number)],
});

// Orders in different statuses
const orderStatuses = ["draft", "placed", "preparing", "ready", "served"] as const;
for (let i = 0; i < 5; i++) {
  const [order] = await db.insert(orders).values({
    restaurantId: restaurant.id,
    tableId: allTables[i].id,
    waiterId: i % 2 === 0 ? waiter1.id : waiter2.id,
    status: orderStatuses[i],
    subtotal: "21.50",
    tax: "2.15",
    total: "23.65",
  }).returning();

  await db.insert(orderItems).values([
    { orderId: order.id, menuItemId: polloItem.id, quantity: 1, unitPrice: "18.00", itemName: "Pollo a la Plancha", status: "pending" },
    { orderId: order.id, menuItemId: cocaItem.id, quantity: 1, unitPrice: "3.50", itemName: "Coca-Cola", status: "pending" },
  ]);
}

await pool.end();
console.log("Seed complete");
