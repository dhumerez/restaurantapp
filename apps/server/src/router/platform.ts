import { router, publicProcedure } from "../trpc/trpc.js";

export const platformRouter = router({
  publicContact: publicProcedure.query(async ({ ctx }): Promise<{
    contactEmail: string;
    contactPhone: string;
  }> => {
    const s = await ctx.db.query.platformSettings.findFirst();
    return {
      contactEmail: s?.contactEmail ?? "",
      contactPhone: s?.contactPhone ?? "",
    };
  }),
});
