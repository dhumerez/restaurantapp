import { z } from "zod";
import { and, count, eq, gte, isNull } from "drizzle-orm";
import { router, superadminProcedure } from "../trpc/trpc.js";
import { restaurants, user, platformSettings, tables, menuItems, orders } from "@restaurant/db";
import { TRPCError } from "@trpc/server";
import { auth } from "../lib/auth.js";

export const superadminRouter = router({
  restaurants: router({
    list: superadminProcedure.query(async ({ ctx }) => {
      return ctx.db.select().from(restaurants).orderBy(restaurants.createdAt);
    }),
    create: superadminProcedure
      .input(z.object({ name: z.string().min(1), slug: z.string().min(1).regex(/^[a-z0-9-]+$/), address: z.string().optional(), currency: z.string().default("USD"), taxRate: z.string().default("0") }))
      .mutation(async ({ ctx, input }) => {
        const [restaurant] = await ctx.db.insert(restaurants).values(input).returning();
        return restaurant;
      }),
    update: superadminProcedure
      .input(z.object({ id: z.string().uuid(), status: z.enum(["active","trial","suspended","inactive"]).optional(), name: z.string().min(1).optional(), taxRate: z.string().optional(), subscriptionTier: z.enum(["free","subscribed","allaccess"]).optional() }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const [updated] = await ctx.db.update(restaurants).set({ ...data, updatedAt: new Date() }).where(eq(restaurants.id, id)).returning();
        if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
        return updated;
      }),
    get: superadminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const restaurant = await ctx.db.query.restaurants.findFirst({
          where: eq(restaurants.id, input.id),
        });
        if (!restaurant) throw new TRPCError({ code: "NOT_FOUND" });

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const [[staffRow], [tableRow], [menuRow], [orderRow], staff] = await Promise.all([
          ctx.db.select({ c: count() }).from(user).where(eq(user.restaurantId, input.id)),
          ctx.db.select({ c: count() }).from(tables).where(eq(tables.restaurantId, input.id)),
          ctx.db.select({ c: count() }).from(menuItems).where(eq(menuItems.restaurantId, input.id)),
          ctx.db.select({ c: count() }).from(orders).where(and(eq(orders.restaurantId, input.id), gte(orders.createdAt, thirtyDaysAgo))),
          ctx.db.select({
            id: user.id, name: user.name, email: user.email, role: user.role,
            isActive: user.isActive, createdAt: user.createdAt,
          }).from(user).where(eq(user.restaurantId, input.id)).orderBy(user.createdAt),
        ]);

        return {
          restaurant,
          stats: {
            staffCount: staffRow.c,
            tableCount: tableRow.c,
            menuItemCount: menuRow.c,
            orderCount30d: orderRow.c,
          },
          staff,
        };
      }),
    assignAdmin: superadminProcedure
      .input(
        z.discriminatedUnion("mode", [
          z.object({
            restaurantId: z.string().uuid(),
            mode: z.literal("existing"),
            userId: z.string(),
          }),
          z.object({
            restaurantId: z.string().uuid(),
            mode: z.literal("new"),
            email: z.string().email(),
            name: z.string().min(1),
            password: z.string().min(8),
          }),
        ])
      )
      .mutation(async ({ ctx, input }) => {
        // Ensure restaurant exists
        const restaurant = await ctx.db.query.restaurants.findFirst({
          where: eq(restaurants.id, input.restaurantId),
        });
        if (!restaurant) throw new TRPCError({ code: "NOT_FOUND", message: "Restaurant not found" });

        if (input.mode === "existing") {
          // Ensure user exists
          const existing = await ctx.db.query.user.findFirst({
            where: eq(user.id, input.userId),
          });
          if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

          const [patched] = await ctx.db
            .update(user)
            .set({ role: "admin", restaurantId: input.restaurantId, isActive: true, emailVerified: true, updatedAt: new Date() })
            .where(eq(user.id, input.userId))
            .returning();
          return patched;
        } else {
          // Email conflict pre-check
          const conflict = await ctx.db.query.user.findFirst({
            where: eq(user.email, input.email),
          });
          if (conflict) throw new TRPCError({ code: "CONFLICT", message: "Email already registered" });

          // Create via Better Auth
          await auth.api.signUpEmail({ body: { email: input.email, name: input.name, password: input.password } });

          // Look up the created user
          const created = await ctx.db.query.user.findFirst({
            where: eq(user.email, input.email),
          });
          if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "User creation failed" });

          // Patch and return
          const [patched] = await ctx.db
            .update(user)
            .set({ role: "admin", restaurantId: input.restaurantId, isActive: true, emailVerified: true, updatedAt: new Date() })
            .where(eq(user.id, created.id))
            .returning();
          return patched;
        }
      }),
  }),
  pendingUsers: router({
    list: superadminProcedure.query(async ({ ctx }) => {
      return ctx.db.select().from(user).where(isNull(user.role)).orderBy(user.createdAt);
    }),
    approve: superadminProcedure
      .input(z.object({ userId: z.string(), restaurantId: z.string().uuid(), role: z.enum(["admin","waiter","kitchen","cashier"]) }))
      .mutation(async ({ ctx, input }) => {
        await ctx.db.update(user).set({ role: input.role, restaurantId: input.restaurantId, isActive: true, emailVerified: true, updatedAt: new Date() }).where(eq(user.id, input.userId));
        return { success: true };
      }),
  }),
  settings: router({
    get: superadminProcedure.query(async ({ ctx }) => {
      const row = await ctx.db.query.platformSettings.findFirst();
      return {
        contactEmail: row?.contactEmail ?? "",
        contactPhone: row?.contactPhone ?? "",
      };
    }),
    update: superadminProcedure
      .input(z.object({
        contactEmail: z.string().email().or(z.literal("")),
        contactPhone: z.string().max(50),
      }))
      .mutation(async ({ ctx, input }) => {
        await ctx.db
          .insert(platformSettings)
          .values({ id: "singleton", ...input, updatedAt: new Date() })
          .onConflictDoUpdate({
            target: platformSettings.id,
            set: { ...input, updatedAt: new Date() },
          });
        return input;
      }),
  }),
});
