import { eq } from "drizzle-orm";
import {
  restaurants,
  categories,
  menuItems,
  tables,
  orders,
  orderItems,
  ingredients,
  recipeItems,
  user,
} from "@restaurant/db";
import { db } from "../lib/db.js";
import { auth } from "../lib/auth.js";

const PASSWORD = "password123";

async function createStaffAccount(
  email: string,
  name: string,
  role: "admin" | "waiter" | "kitchen" | "cashier",
  restaurantId: string
): Promise<string> {
  const existing = await db.query.user.findFirst({ where: eq(user.email, email) });
  if (existing) return existing.id;

  await auth.api.signUpEmail({
    body: { email, password: PASSWORD, name },
  });

  const [patched] = await db
    .update(user)
    .set({
      role,
      restaurantId,
      emailVerified: true,
      isActive: true,
      updatedAt: new Date(),
    })
    .where(eq(user.email, email))
    .returning();

  return patched.id;
}

async function createSuperadminAccount(email: string, name: string): Promise<string> {
  const existing = await db.query.user.findFirst({ where: eq(user.email, email) });
  if (existing) return existing.id;

  await auth.api.signUpEmail({ body: { email, password: PASSWORD, name } });

  const [patched] = await db
    .update(user)
    .set({ role: "superadmin", restaurantId: null, emailVerified: true, isActive: true, updatedAt: new Date() })
    .where(eq(user.email, email))
    .returning();

  return patched.id;
}

async function main() {
  await createSuperadminAccount("superadmin@demo.com", "Platform Admin");

  const existingRestaurant = await db.query.restaurants.findFirst({
    where: eq(restaurants.slug, "demo"),
  });
  if (existingRestaurant) {
    console.log("Seed already applied — demo restaurant exists. Skipping.");
    return;
  }

  const [restaurant] = await db
    .insert(restaurants)
    .values({
      name: "Demo Restaurant",
      slug: "demo",
      address: "123 Main Street",
      currency: "USD",
      taxRate: "10.00",
      status: "demo",
    })
    .returning();

  // Staff — created through Better Auth so login works.
  const adminId = await createStaffAccount("admin@demo.com", "Admin User", "admin", restaurant.id);
  const waiterId = await createStaffAccount("waiter@demo.com", "Maria Waiter", "waiter", restaurant.id);
  const waiter2Id = await createStaffAccount("carlos@demo.com", "Carlos Waiter", "waiter", restaurant.id);
  await createStaffAccount("kitchen@demo.com", "Chef Kitchen", "kitchen", restaurant.id);
  await createStaffAccount("cashier@demo.com", "Ana Cashier", "cashier", restaurant.id);

  void adminId;

  const [catEntradas, catPrincipales, catBebidas] = await db
    .insert(categories)
    .values([
      { restaurantId: restaurant.id, name: "Entradas", sortOrder: 0 },
      { restaurantId: restaurant.id, name: "Platos Principales", sortOrder: 1 },
      { restaurantId: restaurant.id, name: "Bebidas", sortOrder: 2 },
    ])
    .returning();

  const menuRows = await db
    .insert(menuItems)
    .values([
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
    ])
    .returning();

  const [, , , polloItem, milanesaItem, , , cocaItem] = menuRows;

  const [ingPollo, , , ingCoca] = await db
    .insert(ingredients)
    .values([
      { restaurantId: restaurant.id, name: "Pollo", unit: "kg", currentStock: "5.000", minStock: "1.000", costPerUnit: "4.5000" },
      { restaurantId: restaurant.id, name: "Harina", unit: "kg", currentStock: "3.000", minStock: "0.500", costPerUnit: "1.2000" },
      { restaurantId: restaurant.id, name: "Aceite", unit: "L", currentStock: "2.000", minStock: "0.500", costPerUnit: "2.8000" },
      { restaurantId: restaurant.id, name: "Coca-Cola", unit: "units", currentStock: "24.000", minStock: "6.000", costPerUnit: "1.5000" },
    ])
    .returning();

  await db.insert(recipeItems).values([
    { menuItemId: polloItem.id, ingredientId: ingPollo.id, quantity: "0.300" },
    { menuItemId: milanesaItem.id, ingredientId: ingPollo.id, quantity: "0.250" },
    { menuItemId: cocaItem.id, ingredientId: ingCoca.id, quantity: "1.000" },
  ]);

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

  const orderStatuses = ["draft", "placed", "preparing", "ready", "served"] as const;
  for (let i = 0; i < 5; i++) {
    const [order] = await db
      .insert(orders)
      .values({
        restaurantId: restaurant.id,
        tableId: allTables[i].id,
        waiterId: i % 2 === 0 ? waiterId : waiter2Id,
        status: orderStatuses[i],
        subtotal: "21.50",
        tax: "2.15",
        total: "23.65",
      })
      .returning();

    await db.insert(orderItems).values([
      { orderId: order.id, menuItemId: polloItem.id, quantity: 1, unitPrice: "18.00", itemName: "Pollo a la Plancha", status: "pending" },
      { orderId: order.id, menuItemId: cocaItem.id, quantity: 1, unitPrice: "3.50", itemName: "Coca-Cola", status: "pending" },
    ]);
  }

  console.log("Seed complete");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
