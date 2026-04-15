import {
  pgTable, uuid, varchar, text, decimal, integer,
  boolean, timestamp, unique, jsonb, index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Better Auth core tables
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: varchar("role", { length: 20 })
    .$type<"superadmin" | "admin" | "waiter" | "kitchen" | "cashier">(),
  restaurantId: uuid("restaurant_id"),
  isActive: boolean("is_active").notNull().default(true),
  isAnonymous: boolean("is_anonymous").notNull().default(false),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

// Restaurants
export const restaurants = pgTable("restaurants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  address: text("address"),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).notNull().default("0.00"),
  status: varchar("status", { length: 20 }).notNull().default("active")
    .$type<"active" | "trial" | "suspended" | "inactive" | "demo">(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Categories
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  restaurantId: uuid("restaurant_id").notNull().references(() => restaurants.id),
  name: varchar("name", { length: 255 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("categories_restaurant_id_idx").on(t.restaurantId)]);

// Menu Items
export const menuItems = pgTable("menu_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  restaurantId: uuid("restaurant_id").notNull().references(() => restaurants.id),
  categoryId: uuid("category_id").notNull().references(() => categories.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: varchar("image_url", { length: 500 }),
  isAvailable: boolean("is_available").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("menu_items_restaurant_id_idx").on(t.restaurantId),
  index("menu_items_category_id_idx").on(t.categoryId),
]);

// Tables
export const tables = pgTable("tables", {
  id: uuid("id").primaryKey().defaultRandom(),
  restaurantId: uuid("restaurant_id").notNull().references(() => restaurants.id),
  number: integer("number").notNull(),
  label: varchar("label", { length: 50 }),
  seats: integer("seats").notNull().default(4),
  isActive: boolean("is_active").notNull().default(true),
}, (t) => [unique("tables_restaurant_number").on(t.restaurantId, t.number)]);

// Orders
export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  restaurantId: uuid("restaurant_id").notNull().references(() => restaurants.id),
  tableId: uuid("table_id").notNull().references(() => tables.id),
  waiterId: text("waiter_id").notNull().references(() => user.id),
  status: varchar("status", { length: 20 }).notNull().default("draft")
    .$type<"draft" | "placed" | "preparing" | "ready" | "served" | "cancelled">(),
  notes: text("notes"),
  discountType: varchar("discount_type", { length: 20 }).notNull().default("none")
    .$type<"none" | "percentage" | "fixed">(),
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }).notNull().default("0.00"),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
  discountReason: text("discount_reason"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull().default("0.00"),
  tax: decimal("tax", { precision: 10, scale: 2 }).notNull().default("0.00"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull().default("0.00"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("orders_restaurant_id_idx").on(t.restaurantId),
  index("orders_status_idx").on(t.status),
  index("orders_restaurant_status_idx").on(t.restaurantId, t.status),
]);

// Order Items
export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  menuItemId: uuid("menu_item_id").notNull().references(() => menuItems.id),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  itemName: varchar("item_name", { length: 255 }).notNull(),
  notes: text("notes"),
  status: varchar("status", { length: 20 }).notNull().default("pending")
    .$type<"pending" | "preparing" | "ready" | "served" | "cancelled">(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("order_items_order_id_idx").on(t.orderId)]);

// Order Events (audit trail)
export const orderEvents = pgTable("order_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id),
  action: varchar("action", { length: 30 }).notNull()
    .$type<"created"|"items_updated"|"placed"|"status_changed"|"item_status_changed"|"transferred"|"merged"|"discount_applied"|"served"|"cancelled">(),
  details: jsonb("details").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Ingredients
export const ingredients = pgTable("ingredients", {
  id: uuid("id").primaryKey().defaultRandom(),
  restaurantId: uuid("restaurant_id").notNull().references(() => restaurants.id),
  name: varchar("name", { length: 255 }).notNull(),
  unit: varchar("unit", { length: 10 }).notNull().$type<"g"|"kg"|"ml"|"L"|"units">(),
  currentStock: decimal("current_stock", { precision: 10, scale: 3 }).notNull().default("0.000"),
  minStock: decimal("min_stock", { precision: 10, scale: 3 }).notNull().default("0.000"),
  costPerUnit: decimal("cost_per_unit", { precision: 10, scale: 4 }).notNull().default("0.0000"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("ingredients_restaurant_id_idx").on(t.restaurantId)]);

// Recipe Items
export const recipeItems = pgTable("recipe_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  menuItemId: uuid("menu_item_id").notNull().references(() => menuItems.id, { onDelete: "cascade" }),
  ingredientId: uuid("ingredient_id").notNull().references(() => ingredients.id, { onDelete: "cascade" }),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
}, (t) => [unique("recipe_items_menu_ingredient").on(t.menuItemId, t.ingredientId)]);

// Inventory Transactions
export const inventoryTransactions = pgTable("inventory_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  restaurantId: uuid("restaurant_id").notNull().references(() => restaurants.id),
  ingredientId: uuid("ingredient_id").notNull().references(() => ingredients.id),
  type: varchar("type", { length: 20 }).notNull()
    .$type<"purchase"|"usage"|"waste"|"adjustment">(),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  orderId: uuid("order_id").references(() => orders.id),
  notes: text("notes"),
  createdBy: text("created_by").notNull().references(() => user.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("inv_tx_restaurant_id_idx").on(t.restaurantId),
  index("inv_tx_ingredient_id_idx").on(t.ingredientId),
  index("inv_tx_restaurant_created_idx").on(t.restaurantId, t.createdAt),
]);

// Push Subscriptions
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("push_sub_user_id_idx").on(t.userId)]);

// Relations
export const restaurantsRelations = relations(restaurants, ({ many }) => ({
  categories: many(categories),
  menuItems: many(menuItems),
  tables: many(tables),
  orders: many(orders),
  ingredients: many(ingredients),
  inventoryTransactions: many(inventoryTransactions),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  restaurant: one(restaurants, { fields: [categories.restaurantId], references: [restaurants.id] }),
  menuItems: many(menuItems),
}));

export const menuItemsRelations = relations(menuItems, ({ one, many }) => ({
  restaurant: one(restaurants, { fields: [menuItems.restaurantId], references: [restaurants.id] }),
  category: one(categories, { fields: [menuItems.categoryId], references: [categories.id] }),
  recipeItems: many(recipeItems),
}));

export const tablesRelations = relations(tables, ({ one, many }) => ({
  restaurant: one(restaurants, { fields: [tables.restaurantId], references: [restaurants.id] }),
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  restaurant: one(restaurants, { fields: [orders.restaurantId], references: [restaurants.id] }),
  table: one(tables, { fields: [orders.tableId], references: [tables.id] }),
  waiter: one(user, { fields: [orders.waiterId], references: [user.id] }),
  items: many(orderItems),
  events: many(orderEvents),
  inventoryTransactions: many(inventoryTransactions),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  menuItem: one(menuItems, { fields: [orderItems.menuItemId], references: [menuItems.id] }),
}));

export const ingredientsRelations = relations(ingredients, ({ one, many }) => ({
  restaurant: one(restaurants, { fields: [ingredients.restaurantId], references: [restaurants.id] }),
  recipeItems: many(recipeItems),
  transactions: many(inventoryTransactions),
}));

export const recipeItemsRelations = relations(recipeItems, ({ one }) => ({
  menuItem: one(menuItems, { fields: [recipeItems.menuItemId], references: [menuItems.id] }),
  ingredient: one(ingredients, { fields: [recipeItems.ingredientId], references: [ingredients.id] }),
}));
