import { getIO } from "./index.js";

export function emitOrderNew(restaurantId: string, order: unknown) {
  getIO().to(`restaurant:${restaurantId}`).emit("order:new", order);
}

export function emitOrderItemUpdated(restaurantId: string, data: unknown) {
  getIO().to(`restaurant:${restaurantId}`).emit("order:item-updated", data);
}

export function emitOrderReady(restaurantId: string, order: unknown) {
  getIO().to(`waiter:${restaurantId}`).emit("order:ready", order);
}

export function emitOrderCancelled(restaurantId: string, order: unknown) {
  getIO().to(`restaurant:${restaurantId}`).emit("order:cancelled", order);
}

export function emitMenuUpdated(restaurantId: string, data: unknown) {
  getIO().to(`restaurant:${restaurantId}`).emit("menu:updated", data);
}
