import { z } from "zod";
import { router, adminProcedure, restaurantProcedure } from "../trpc/trpc.js";
import * as menuService from "../services/menu.service.js";

export const menuRouter = router({
  listCategories: restaurantProcedure.query(({ ctx }) =>
    menuService.listCategories(ctx.db, ctx.restaurantId)
  ),

  createCategory: adminProcedure
    .input(z.object({ name: z.string().min(1), sortOrder: z.number().optional() }))
    .mutation(({ ctx, input }) =>
      menuService.createCategory(ctx.db, ctx.restaurantId, input)
    ),

  updateCategory: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().optional(),
      sortOrder: z.number().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return menuService.updateCategory(ctx.db, ctx.restaurantId, id, data);
    }),

  listItems: restaurantProcedure.query(({ ctx }) =>
    menuService.listMenuItems(ctx.db, ctx.restaurantId)
  ),

  createItem: adminProcedure
    .input(z.object({
      categoryId: z.string().uuid(),
      name: z.string().min(1),
      description: z.string().optional(),
      price: z.string().regex(/^\d+(\.\d{1,2})?$/),
      sortOrder: z.number().optional(),
    }))
    .mutation(({ ctx, input }) =>
      menuService.createMenuItem(ctx.db, ctx.restaurantId, input)
    ),

  updateItem: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().optional(),
      description: z.string().optional(),
      price: z.string().optional(),
      isAvailable: z.boolean().optional(),
      sortOrder: z.number().optional(),
      categoryId: z.string().uuid().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return menuService.updateMenuItem(ctx.db, ctx.restaurantId, id, data);
    }),

  deleteItem: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ ctx, input }) =>
      menuService.deleteMenuItem(ctx.db, ctx.restaurantId, input.id)
    ),
});
