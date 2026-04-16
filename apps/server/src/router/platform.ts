import { router, publicProcedure } from "../trpc/trpc.js";
import { platformSettings } from "@restaurant/db";

export const platformRouter = router({
  publicContact: publicProcedure.query(async ({ ctx }) => {
    const s = await ctx.db.select().from(platformSettings).limit(1).then((r) => r[0]);
    return {
      contactEmail: s?.contactEmail ?? "",
      contactPhone: s?.contactPhone ?? "",
    };
  }),
});
