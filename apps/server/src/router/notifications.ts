import { observable } from "@trpc/server/observable";
import { router, restaurantProcedure, kitchenProcedure, adminProcedure } from "../trpc/trpc.js";
import {
  emitter,
  type OrderChangeEvent,
  type KitchenChangeEvent,
  type InventoryLowStockEvent,
  type MenuChangeEvent,
} from "../lib/emitter.js";

export const notificationsRouter = router({
  orders: router({
    onChange: restaurantProcedure.subscription(({ ctx }) => {
      return observable<OrderChangeEvent>((emit) => {
        const handler = (data: OrderChangeEvent) => emit.next(data);
        emitter.on(`orders:${ctx.restaurantId}`, handler);
        return () => emitter.off(`orders:${ctx.restaurantId}`, handler);
      });
    }),
  }),

  kitchen: router({
    onChange: kitchenProcedure.subscription(({ ctx }) => {
      return observable<KitchenChangeEvent>((emit) => {
        const handler = (data: KitchenChangeEvent) => emit.next(data);
        emitter.on(`kitchen:${ctx.restaurantId}`, handler);
        return () => emitter.off(`kitchen:${ctx.restaurantId}`, handler);
      });
    }),
  }),

  inventory: router({
    onLowStock: adminProcedure.subscription(({ ctx }) => {
      return observable<InventoryLowStockEvent>((emit) => {
        const handler = (data: InventoryLowStockEvent) => emit.next(data);
        emitter.on(`inventory:${ctx.restaurantId}`, handler);
        return () => emitter.off(`inventory:${ctx.restaurantId}`, handler);
      });
    }),
  }),

  menu: router({
    onChange: restaurantProcedure.subscription(({ ctx }) => {
      return observable<MenuChangeEvent>((emit) => {
        const handler = (data: MenuChangeEvent) => emit.next(data);
        emitter.on(`menu:${ctx.restaurantId}`, handler);
        return () => emitter.off(`menu:${ctx.restaurantId}`, handler);
      });
    }),
  }),
});
