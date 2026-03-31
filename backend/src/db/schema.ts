import {
  pgTable,
  uuid,
  varchar,
  text,
  decimal,
  integer,
  boolean,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Superadmins (platform-level) ────────────────────────────
export const superadmins = pgTable("superadmins", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Restaurants ─────────────────────────────────────────────
export const restaurants = pgTable("restaurants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  address: text("address"),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("0.00").notNull(),
  status: varchar("status", { length: 20 })
    .default("active")
    .notNull()
    .$type<"active" | "trial" | "suspended" | "inactive">(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const restaurantsRelations = relations(restaurants, ({ many }) => ({
  users: many(users),
  categories: many(categories),
  menuItems: many(menuItems),
  tables: many(tables),
  orders: many(orders),
}));

// ─── Users ───────────────────────────────────────────────────
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    role: varchar("role", { length: 20 })
      .notNull()
      .$type<"admin" | "waiter" | "kitchen">(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique("users_restaurant_email").on(table.restaurantId, table.email)]
);

export const usersRelations = relations(users, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [users.restaurantId],
    references: [restaurants.id],
  }),
}));

// ─── Categories ──────────────────────────────────────────────
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  restaurantId: uuid("restaurant_id")
    .notNull()
    .references(() => restaurants.id),
  name: varchar("name", { length: 255 }).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [categories.restaurantId],
    references: [restaurants.id],
  }),
  menuItems: many(menuItems),
}));

// ─── Menu Items ──────────────────────────────────────────────
export const menuItems = pgTable("menu_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  restaurantId: uuid("restaurant_id")
    .notNull()
    .references(() => restaurants.id),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: varchar("image_url", { length: 500 }),
  stockCount: integer("stock_count"), // NULL = unlimited
  isAvailable: boolean("is_available").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const menuItemsRelations = relations(menuItems, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [menuItems.restaurantId],
    references: [restaurants.id],
  }),
  category: one(categories, {
    fields: [menuItems.categoryId],
    references: [categories.id],
  }),
}));

// ─── Tables ──────────────────────────────────────────────────
export const tables = pgTable(
  "tables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    number: integer("number").notNull(),
    label: varchar("label", { length: 50 }),
    seats: integer("seats").default(4).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
  },
  (table) => [unique("tables_restaurant_number").on(table.restaurantId, table.number)]
);

export const tablesRelations = relations(tables, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [tables.restaurantId],
    references: [restaurants.id],
  }),
  orders: many(orders),
}));

// ─── Orders ──────────────────────────────────────────────────
export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  restaurantId: uuid("restaurant_id")
    .notNull()
    .references(() => restaurants.id),
  tableId: uuid("table_id")
    .notNull()
    .references(() => tables.id),
  waiterId: uuid("waiter_id")
    .notNull()
    .references(() => users.id),
  status: varchar("status", { length: 20 })
    .default("draft")
    .notNull()
    .$type<"draft" | "placed" | "preparing" | "ready" | "served" | "cancelled">(),
  notes: text("notes"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).default("0.00").notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).default("0.00").notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const ordersRelations = relations(orders, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [orders.restaurantId],
    references: [restaurants.id],
  }),
  table: one(tables, {
    fields: [orders.tableId],
    references: [tables.id],
  }),
  waiter: one(users, {
    fields: [orders.waiterId],
    references: [users.id],
  }),
  items: many(orderItems),
}));

// ─── Order Items ─────────────────────────────────────────────
export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  menuItemId: uuid("menu_item_id")
    .notNull()
    .references(() => menuItems.id),
  quantity: integer("quantity").default(1).notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  itemName: varchar("item_name", { length: 255 }).notNull(),
  notes: text("notes"),
  status: varchar("status", { length: 20 })
    .default("pending")
    .notNull()
    .$type<"pending" | "preparing" | "ready" | "served" | "cancelled">(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  menuItem: one(menuItems, {
    fields: [orderItems.menuItemId],
    references: [menuItems.id],
  }),
}));
