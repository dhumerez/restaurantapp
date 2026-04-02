import { Request, Response } from "express";
import * as kitchenService from "./kitchen.service.js";
import * as ordersService from "../orders/orders.service.js";
import { emitOrderItemUpdated, emitOrderReady } from "../../socket/orderEvents.js";

export async function getActiveOrders(req: Request, res: Response) {
  const orders = await kitchenService.getActiveOrders(req.user!.restaurantId);
  res.json(orders);
}

export async function updateItemStatus(req: Request, res: Response) {
  const item = await kitchenService.updateItemStatus(
    req.user!.restaurantId,
    req.params.id as string,
    req.body.status
  );
  await ordersService.logEvent(item.orderId, req.user!.userId, "item_status_changed", {
    itemId: item.id,
    itemName: item.itemName,
    status: req.body.status,
  });
  emitOrderItemUpdated(req.user!.restaurantId, item);
  res.json(item);
}

export async function updateOrderStatus(req: Request, res: Response) {
  const order = await kitchenService.updateOrderStatus(
    req.user!.restaurantId,
    req.params.id as string,
    req.body.status
  );
  await ordersService.logEvent(order.id, req.user!.userId, "status_changed", {
    status: req.body.status,
  });
  if (order.status === "ready") {
    emitOrderReady(req.user!.restaurantId, order);
  } else {
    emitOrderItemUpdated(req.user!.restaurantId, order);
  }
  res.json(order);
}
