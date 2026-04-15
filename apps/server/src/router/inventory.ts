import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { router, adminProcedure } from "../trpc/trpc.js";
import { ingredients, recipeItems, inventoryTransactions, menuItems } from "@restaurant/db";
import { TRPCError } from "@trpc/server";

export const inventoryRouter = router({
  ingredients: router({
    list: adminProcedure.query(async ({ ctx }) => {
      return ctx.db.select().from(ingredients).where(eq(ingredients.restaurantId, ctx.restaurantId)).orderBy(ingredients.name);
    }),
    create: adminProcedure
      .input(z.object({ name: z.string().min(1), unit: z.enum(["g", "kg", "ml", "L", "units"]), currentStock: z.string().default("0"), minStock: z.string().default("0"), costPerUnit: z.string().default("0") }))
      .mutation(async ({ ctx, input }) => {
        const [ingredient] = await ctx.db.insert(ingredients).values({ restaurantId: ctx.restaurantId, ...input }).returning();
        return ingredient;
      }),
    update: adminProcedure
      .input(z.object({ id: z.string().uuid(), name: z.string().min(1).optional(), unit: z.enum(["g", "kg", "ml", "L", "units"]).optional(), minStock: z.string().optional(), costPerUnit: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const [updated] = await ctx.db.update(ingredients).set({ ...data, updatedAt: new Date() }).where(and(eq(ingredients.id, id), eq(ingredients.restaurantId, ctx.restaurantId))).returning();
        if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
        return updated;
      }),
    restock: adminProcedure
      .input(z.object({ id: z.string().uuid(), quantity: z.string(), notes: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const [ingredient] = await ctx.db.select().from(ingredients).where(and(eq(ingredients.id, input.id), eq(ingredients.restaurantId, ctx.restaurantId)));
        if (!ingredient) throw new TRPCError({ code: "NOT_FOUND" });
        await ctx.db.update(ingredients).set({ currentStock: sql`${ingredients.currentStock} + ${input.quantity}`, updatedAt: new Date() }).where(eq(ingredients.id, input.id));
        await ctx.db.insert(inventoryTransactions).values({ restaurantId: ctx.restaurantId, ingredientId: input.id, type: "purchase", quantity: input.quantity, notes: input.notes ?? "Restock", createdBy: ctx.user!.id });
        return { success: true };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        await ctx.db.delete(ingredients).where(and(eq(ingredients.id, input.id), eq(ingredients.restaurantId, ctx.restaurantId)));
        return { success: true };
      }),
  }),
  recipes: router({
    get: adminProcedure
      .input(z.object({ menuItemId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const [item] = await ctx.db.select().from(menuItems).where(and(eq(menuItems.id, input.menuItemId), eq(menuItems.restaurantId, ctx.restaurantId)));
        if (!item) throw new TRPCError({ code: "NOT_FOUND" });
        return ctx.db.select().from(recipeItems).where(eq(recipeItems.menuItemId, input.menuItemId));
      }),
    upsert: adminProcedure
      .input(z.object({ menuItemId: z.string().uuid(), items: z.array(z.object({ ingredientId: z.string().uuid(), quantity: z.string() })) }))
      .mutation(async ({ ctx, input }) => {
        const [item] = await ctx.db.select().from(menuItems).where(and(eq(menuItems.id, input.menuItemId), eq(menuItems.restaurantId, ctx.restaurantId)));
        if (!item) throw new TRPCError({ code: "NOT_FOUND" });
        await ctx.db.delete(recipeItems).where(eq(recipeItems.menuItemId, input.menuItemId));
        if (input.items.length > 0) {
          await ctx.db.insert(recipeItems).values(input.items.map((i) => ({ menuItemId: input.menuItemId, ingredientId: i.ingredientId, quantity: i.quantity })));
        }
        return { success: true };
      }),
  }),
  transactions: router({
    list: adminProcedure
      .input(z.object({ ingredientId: z.string().uuid().optional(), limit: z.number().int().max(100).default(50) }).optional())
      .query(async ({ ctx, input }) => {
        const conditions = [eq(inventoryTransactions.restaurantId, ctx.restaurantId)];
        if (input?.ingredientId) conditions.push(eq(inventoryTransactions.ingredientId, input.ingredientId));
        return ctx.db.select().from(inventoryTransactions).where(and(...conditions)).orderBy(sql`${inventoryTransactions.createdAt} DESC`).limit(input?.limit ?? 50);
      }),
  }),
});
