import { z } from "zod";
import { router, adminProcedure } from "../trpc/trpc.js";
import * as staffService from "../services/staff.service.js";

const roleEnum = z.enum(["admin", "waiter", "kitchen", "cashier"]);

export const staffRouter = router({
  list: adminProcedure.query(({ ctx }) =>
    staffService.listStaff(ctx.db, ctx.restaurantId)
  ),

  create: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      email: z.string().email(),
      role: roleEnum,
      password: z.string().min(8),
    }))
    .mutation(({ ctx, input }) =>
      staffService.createStaff(ctx.db, ctx.restaurantId, input)
    ),

  update: adminProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      role: roleEnum.optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return staffService.updateStaff(ctx.db, ctx.restaurantId, id, data);
    }),
});
