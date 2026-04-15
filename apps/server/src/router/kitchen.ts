import { z } from "zod";
import { router, kitchenProcedure, restaurantProcedure } from "../trpc/trpc.js";
import * as kitchenService from "../services/kitchen.service.js";

export const kitchenRouter = router({
  activeOrders: restaurantProcedure.query(({ ctx }) =>
    ctx.db.query.orders.findMany({
      where: (o, { and, eq, inArray }) =>
        and(
          eq(o.restaurantId, ctx.restaurantId),
          inArray(o.status, ["placed", "preparing", "ready"])
        ),
      with: { items: true, table: true },
      orderBy: (o, { asc }) => [asc(o.createdAt)],
    })
  ),

  updateItemStatus: kitchenProcedure
    .input(z.object({
      orderId: z.string().uuid(),
      itemId: z.string().uuid(),
      status: z.enum(["pending", "preparing", "ready", "served", "cancelled"]),
    }))
    .mutation(({ ctx, input }) =>
      kitchenService.updateItemStatus(
        ctx.db,
        input.orderId,
        input.itemId,
        input.status,
        ctx.user.id
      )
    ),
});
