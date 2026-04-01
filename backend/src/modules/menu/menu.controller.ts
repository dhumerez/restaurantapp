import { Request, Response } from "express";
import * as menuService from "./menu.service.js";

// ─── Categories ──────────────────────────────────────────────

export async function listCategories(req: Request, res: Response) {
  const categories = await menuService.listCategories(req.user!.restaurantId);
  res.json(categories);
}

export async function createCategory(req: Request, res: Response) {
  const category = await menuService.createCategory(req.user!.restaurantId, req.body);
  res.status(201).json(category);
}

export async function updateCategory(req: Request, res: Response) {
  const category = await menuService.updateCategory(
    req.user!.restaurantId,
    req.params.id as string,
    req.body
  );
  res.json(category);
}

export async function deleteCategory(req: Request, res: Response) {
  await menuService.deleteCategory(req.user!.restaurantId, req.params.id as string);
  res.status(204).end();
}

// ─── Menu Items ──────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listMenuItems(req: Request, res: Response) {
  const category = req.query.category as string | undefined;
  if (category && !UUID_REGEX.test(category)) {
    res.status(400).json({ error: "Invalid category format" });
    return;
  }
  const items = await menuService.listMenuItems(req.user!.restaurantId, category);
  res.json(items);
}

export async function createMenuItem(req: Request, res: Response) {
  const item = await menuService.createMenuItem(req.user!.restaurantId, req.body);
  res.status(201).json(item);
}

export async function updateMenuItem(req: Request, res: Response) {
  const item = await menuService.updateMenuItem(
    req.user!.restaurantId,
    req.params.id as string,
    req.body
  );
  res.json(item);
}

export async function deleteMenuItem(req: Request, res: Response) {
  await menuService.deleteMenuItem(req.user!.restaurantId, req.params.id as string);
  res.status(204).end();
}

export async function updateStock(req: Request, res: Response) {
  const item = await menuService.updateStock(
    req.user!.restaurantId,
    req.params.id as string,
    req.body.stockCount
  );
  res.json(item);
}
