import { z } from "zod";
import { router, adminProcedure, restaurantProcedure } from "../trpc/trpc.js";
import * as tablesService from "../services/tables.service.js";

export const tablesRouter = router({
  list: restaurantProcedure.query(({ ctx }) =>
    tablesService.listTables(ctx.db, ctx.restaurantId)
  ),

  create: adminProcedure
    .input(z.object({
      number: z.number().int().positive(),
      label: z.string().optional(),
      seats: z.number().int().positive().optional(),
    }))
    .mutation(({ ctx, input }) =>
      tablesService.createTable(ctx.db, ctx.restaurantId, input)
    ),

  update: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      label: z.string().optional(),
      seats: z.number().int().positive().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return tablesService.updateTable(ctx.db, ctx.restaurantId, id, data);
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ ctx, input }) =>
      tablesService.deleteTable(ctx.db, ctx.restaurantId, input.id)
    ),
});
