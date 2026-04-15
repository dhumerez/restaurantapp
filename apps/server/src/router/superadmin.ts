import { z } from "zod";
import { eq, isNull } from "drizzle-orm";
import { router, superadminProcedure } from "../trpc/trpc.js";
import { restaurants, user } from "@restaurant/db";
import { TRPCError } from "@trpc/server";

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
      .input(z.object({ id: z.string().uuid(), status: z.enum(["active","trial","suspended","inactive"]).optional(), name: z.string().min(1).optional(), taxRate: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const [updated] = await ctx.db.update(restaurants).set({ ...data, updatedAt: new Date() }).where(eq(restaurants.id, id)).returning();
        if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
        return updated;
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
});
