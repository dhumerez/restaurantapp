import { z } from "zod";
import { router, waiterProcedure, restaurantProcedure, cashierProcedure } from "../trpc/trpc.js";
import * as ordersService from "../services/orders.service.js";

const orderItemInput = z.object({
  menuItemId: z.string().uuid(),
  quantity: z.number().int().positive(),
  notes: z.string().optional(),
});

export const ordersRouter = router({
  list: restaurantProcedure
    .input(z.object({
      status: z.enum(["draft","placed","preparing","ready","served","cancelled"]).optional(),
    }).optional())
    .query(({ ctx, input }) => {
      return ctx.db.query.orders.findMany({
        where: (o, { eq, and }) =>
          input?.status
            ? and(eq(o.restaurantId, ctx.restaurantId), eq(o.status, input.status!))
            : eq(o.restaurantId, ctx.restaurantId),
        with: { items: true, table: true },
        orderBy: (o, { desc }) => [desc(o.createdAt)],
      });
    }),

  create: waiterProcedure
    .input(z.object({
      tableId: z.string().uuid(),
      notes: z.string().optional(),
      items: z.array(orderItemInput).min(1),
    }))
    .mutation(({ ctx, input }) =>
      ordersService.createOrder(ctx.db, ctx.restaurantId, ctx.user.id, input)
    ),

  update: waiterProcedure
    .input(z.object({
      orderId: z.string().uuid(),
      notes: z.string().optional(),
      items: z.array(orderItemInput).optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { orderId, ...data } = input;
      return ordersService.updateOrder(ctx.db, ctx.restaurantId, orderId, data);
    }),

  place: waiterProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .mutation(({ ctx, input }) =>
      ordersService.placeOrder(ctx.db, ctx.restaurantId, input.orderId)
    ),

  serve: waiterProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .mutation(({ ctx, input }) =>
      ordersService.serveOrder(ctx.db, ctx.restaurantId, input.orderId)
    ),

  cancel: waiterProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .mutation(({ ctx, input }) =>
      ordersService.cancelOrder(ctx.db, ctx.restaurantId, input.orderId)
    ),

  applyDiscount: cashierProcedure
    .input(z.object({
      orderId: z.string().uuid(),
      type: z.enum(["none", "percentage", "fixed"]),
      value: z.number().min(0),
      reason: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { orderId, ...data } = input;
      return ordersService.applyDiscount(ctx.db, ctx.restaurantId, orderId, data);
    }),

  transfer: waiterProcedure
    .input(z.object({
      orderId: z.string().uuid(),
      targetTableId: z.string().uuid(),
    }))
    .mutation(({ ctx, input }) =>
      ordersService.transferOrder(ctx.db, ctx.restaurantId, input.orderId, {
        targetTableId: input.targetTableId,
      })
    ),

  merge: waiterProcedure
    .input(z.object({
      sourceOrderId: z.string().uuid(),
      targetOrderId: z.string().uuid(),
    }))
    .mutation(({ ctx, input }) =>
      ordersService.mergeOrders(ctx.db, ctx.restaurantId, input.sourceOrderId, input.targetOrderId)
    ),
});
