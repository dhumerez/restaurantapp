import { z } from "zod";
import { router, adminProcedure, cashierProcedure } from "../trpc/trpc.js";
import * as reportsService from "../services/reports.service.js";

const periodSchema = z.enum(["day", "week", "month"]);

export const reportsRouter = router({
  revenue: cashierProcedure
    .input(z.object({ period: periodSchema }))
    .query(({ ctx, input }) =>
      reportsService.getRevenueReport(ctx.db, ctx.restaurantId, input.period)
    ),

  topItems: adminProcedure
    .input(z.object({ period: periodSchema, limit: z.number().int().positive().default(10) }))
    .query(({ ctx, input }) =>
      reportsService.getTopSellingItems(ctx.db, ctx.restaurantId, input.period, input.limit)
    ),
});
