import "dotenv/config";
import { hashPassword } from "../shared/auth-utils.js";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

async function seed() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const db = drizzle(pool, { schema });

  console.log("Seeding database...");

  // Create superadmin
  const superadminHash = await hashPassword("superadmin123");
  await db.insert(schema.superadmins).values({
    name: "Platform Admin",
    email: "super@platform.com",
    passwordHash: superadminHash,
  });
  console.log("Created superadmin: super@platform.com");

  // Create restaurant
  const [restaurant] = await db
    .insert(schema.restaurants)
    .values({
      name: "Demo Restaurant",
      slug: "demo",
      address: "123 Main Street",
      currency: "BOB",
      taxRate: "10.00",
    })
    .returning();

  console.log("Created restaurant:", restaurant.name);

  // Create users
  const passwordHash = await hashPassword("password123");

  const usersData = [
    { name: "Admin", email: "admin@demo.com", role: "admin" as const },
    { name: "María", email: "waiter@demo.com", role: "waiter" as const },
    { name: "Carlos (Chef)", email: "kitchen@demo.com", role: "kitchen" as const },
  ];

  for (const userData of usersData) {
    await db.insert(schema.users).values({
      ...userData,
      restaurantId: restaurant.id,
      passwordHash,
    });
    console.log(`Created user: ${userData.name} (${userData.role})`);
  }

  // Create categories
  const categoriesData = [
    { name: "Entradas", sortOrder: 1 },
    { name: "Platos Principales", sortOrder: 2 },
    { name: "Postres", sortOrder: 3 },
    { name: "Bebidas", sortOrder: 4 },
  ];

  const createdCategories = [];
  for (const cat of categoriesData) {
    const [category] = await db
      .insert(schema.categories)
      .values({ ...cat, restaurantId: restaurant.id })
      .returning();
    createdCategories.push(category);
    console.log(`Created category: ${category.name}`);
  }

  // Create menu items
  const menuItemsData = [
    // Entradas
    { categoryIdx: 0, name: "Ensalada César", price: "9.99", description: "Lechuga romana fresca con aderezo césar", stockCount: null },
    { categoryIdx: 0, name: "Pan de Ajo", price: "5.99", description: "Pan tostado con mantequilla de ajo", stockCount: 20 },
    { categoryIdx: 0, name: "Sopa del Día", price: "7.50", description: "Consulta con tu mesero la sopa del día", stockCount: 15 },
    // Platos Principales
    { categoryIdx: 1, name: "Salmón a la Parrilla", price: "18.99", description: "Salmón atlántico con mantequilla de limón", stockCount: 10 },
    { categoryIdx: 1, name: "Ribeye a la Parrilla", price: "24.99", description: "Corte de 340g con puré de papa al ajo", stockCount: 8 },
    { categoryIdx: 1, name: "Pollo a la Parmesana", price: "15.99", description: "Pollo empanizado con marinara y mozzarella", stockCount: null },
    { categoryIdx: 1, name: "Pasta Primavera", price: "13.99", description: "Verduras de temporada en salsa cremosa", stockCount: null },
    // Postres
    { categoryIdx: 2, name: "Volcán de Chocolate", price: "8.99", description: "Pastel de chocolate con centro fundido", stockCount: 6 },
    { categoryIdx: 2, name: "Tiramisú", price: "7.99", description: "Clásico postre italiano al café", stockCount: 10 },
    // Bebidas
    { categoryIdx: 3, name: "Limonada Natural", price: "3.99", description: "Limonada preparada en casa", stockCount: null },
    { categoryIdx: 3, name: "Espresso", price: "2.99", description: "Doble shot de espresso", stockCount: null },
    { categoryIdx: 3, name: "Agua Mineral", price: "1.99", description: "Botella 500ml", stockCount: 30 },
  ];

  for (const item of menuItemsData) {
    await db.insert(schema.menuItems).values({
      restaurantId: restaurant.id,
      categoryId: createdCategories[item.categoryIdx].id,
      name: item.name,
      price: item.price,
      description: item.description,
      stockCount: item.stockCount,
    });
    console.log(`Created menu item: ${item.name}${item.stockCount !== null ? ` (stock: ${item.stockCount})` : " (unlimited)"}`);
  }

  // Create tables
  for (let i = 1; i <= 10; i++) {
    await db.insert(schema.tables).values({
      restaurantId: restaurant.id,
      number: i,
      label: i <= 6 ? `Indoor ${i}` : `Patio ${i - 6}`,
      seats: i <= 4 ? 2 : i <= 8 ? 4 : 6,
    });
  }
  console.log("Created 10 tables");

  console.log("\n--- Seed Complete ---");
  console.log("Login credentials:");
  console.log("  Superadmin: super@platform.com / superadmin123");
  console.log("  Admin:      admin@demo.com / password123");
  console.log("  Waiter:     waiter@demo.com / password123");
  console.log("  Kitchen:    kitchen@demo.com / password123");

  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
