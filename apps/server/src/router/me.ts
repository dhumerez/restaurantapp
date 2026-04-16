import { eq } from "drizzle-orm";
import { restaurants } from "@restaurant/db";
import { router, protectedProcedure } from "../trpc/trpc.js";

export const meRouter = router({
  context: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === "superadmin" || !ctx.user.restaurantId) {
      return { user: ctx.user, restaurantStatus: null as string | null };
    }
    const r = await ctx.db.query.restaurants.findFirst({
      where: eq(restaurants.id, ctx.user.restaurantId),
    });
    return { user: ctx.user, restaurantStatus: r?.status ?? null };
  }),
});
