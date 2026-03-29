import { Request, Response } from "express";
import * as ordersService from "./orders.service.js";
import { emitOrderNew, emitOrderCancelled, emitOrderItemUpdated } from "../../socket/orderEvents.js";

export async function listOrders(req: Request, res: Response) {
  // Waiters only see their own orders; admins see all
  const waiterId = req.user!.role === "waiter" ? req.user!.userId : undefined;
  const orders = await ordersService.listOrders(
    req.user!.restaurantId,
    req.query.status as string | undefined,
    req.query.table as string | undefined,
    waiterId
  );
  res.json(orders);
}

export async function getOrder(req: Request, res: Response) {
  const order = await ordersService.getOrder(req.user!.restaurantId, req.params.id as string);
  res.json(order);
}

export async function createOrder(req: Request, res: Response) {
  const order = await ordersService.createOrder(
    req.user!.restaurantId,
    req.user!.userId,
    req.body
  );
  res.status(201).json(order);
}

export async function updateOrder(req: Request, res: Response) {
  const order = await ordersService.updateOrder(
    req.user!.restaurantId,
    req.params.id as string,
    req.body
  );
  // Notify all users when an active order is edited
  if (order.status !== "draft") {
    emitOrderItemUpdated(req.user!.restaurantId, order);
  }
  res.json(order);
}

export async function placeOrder(req: Request, res: Response) {
  const order = await ordersService.placeOrder(req.user!.restaurantId, req.params.id as string);
  emitOrderNew(req.user!.restaurantId, order);
  res.json(order);
}

export async function serveOrder(req: Request, res: Response) {
  const order = await ordersService.serveOrder(req.user!.restaurantId, req.params.id as string);
  emitOrderItemUpdated(req.user!.restaurantId, order);
  res.json(order);
}

export async function cancelOrder(req: Request, res: Response) {
  const order = await ordersService.cancelOrder(req.user!.restaurantId, req.params.id as string);
  emitOrderCancelled(req.user!.restaurantId, order);
  res.json(order);
}
