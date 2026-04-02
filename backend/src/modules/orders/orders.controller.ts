import { Request, Response } from "express";
import * as ordersService from "./orders.service.js";
import { emitOrderNew, emitOrderCancelled, emitOrderItemUpdated } from "../../socket/orderEvents.js";
import { ForbiddenError } from "../../utils/errors.js";

/** Enforce that waiters can only act on their own orders */
async function enforceOwnership(req: Request, orderId: string) {
  if (req.user!.role !== "waiter") return;
  const order = await ordersService.getOrder(req.user!.restaurantId, orderId);
  if (order.waiterId !== req.user!.userId) {
    throw new ForbiddenError("You can only manage your own orders");
  }
}

const VALID_STATUSES = new Set(["draft", "placed", "preparing", "ready", "served", "cancelled"]);
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listOrders(req: Request, res: Response) {
  const status = req.query.status as string | undefined;
  const table = req.query.table as string | undefined;

  if (status && !status.split(",").every((s) => VALID_STATUSES.has(s))) {
    res.status(400).json({ error: "Invalid status value" });
    return;
  }
  if (table && !UUID_REGEX.test(table)) {
    res.status(400).json({ error: "Invalid table format" });
    return;
  }

  // Waiters only see their own orders; admins see all
  const waiterId = req.user!.role === "waiter" ? req.user!.userId : undefined;
  const orders = await ordersService.listOrders(
    req.user!.restaurantId,
    status,
    table,
    waiterId
  );
  res.json(orders);
}

export async function getOrder(req: Request, res: Response) {
  const order = await ordersService.getOrder(req.user!.restaurantId, req.params.id as string);
  if (req.user!.role === "waiter" && order.waiterId !== req.user!.userId) {
    throw new ForbiddenError("You can only view your own orders");
  }
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
  await enforceOwnership(req, req.params.id as string);
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
  await enforceOwnership(req, req.params.id as string);
  const order = await ordersService.placeOrder(req.user!.restaurantId, req.params.id as string);
  emitOrderNew(req.user!.restaurantId, order);
  res.json(order);
}

export async function serveOrder(req: Request, res: Response) {
  await enforceOwnership(req, req.params.id as string);
  const order = await ordersService.serveOrder(req.user!.restaurantId, req.params.id as string);
  emitOrderItemUpdated(req.user!.restaurantId, order);
  res.json(order);
}

export async function applyDiscount(req: Request, res: Response) {
  const order = await ordersService.applyDiscount(
    req.user!.restaurantId,
    req.params.id as string,
    req.body
  );
  emitOrderItemUpdated(req.user!.restaurantId, order);
  res.json(order);
}

export async function transferOrder(req: Request, res: Response) {
  await enforceOwnership(req, req.params.id as string);
  const order = await ordersService.transferOrder(
    req.user!.restaurantId,
    req.params.id as string,
    req.body
  );
  emitOrderItemUpdated(req.user!.restaurantId, order);
  res.json(order);
}

export async function mergeOrders(req: Request, res: Response) {
  await enforceOwnership(req, req.params.id as string);
  const order = await ordersService.mergeOrders(
    req.user!.restaurantId,
    req.params.id as string,
    req.params.targetId as string
  );
  emitOrderItemUpdated(req.user!.restaurantId, order);
  res.json(order);
}

export async function cancelOrder(req: Request, res: Response) {
  await enforceOwnership(req, req.params.id as string);
  const order = await ordersService.cancelOrder(req.user!.restaurantId, req.params.id as string);
  emitOrderCancelled(req.user!.restaurantId, order);
  res.json(order);
}
