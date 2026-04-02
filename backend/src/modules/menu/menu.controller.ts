import { Request, Response } from "express";
import * as menuService from "./menu.service.js";
import * as imageService from "./image.service.js";

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

// ─── Image Upload ───────────────────────────────────────────

export async function uploadImage(req: Request, res: Response) {
  if (!req.file) {
    res.status(400).json({ error: "No image file provided" });
    return;
  }

  const restaurantId = req.user!.restaurantId;
  const menuItemId = req.params.id as string;

  // Verify item exists and belongs to restaurant
  const existing = await menuService.getMenuItem(restaurantId, menuItemId);

  // Delete old image if exists
  if (existing.imageUrl) {
    await imageService.deleteImage(existing.imageUrl).catch(() => {});
  }

  const imageUrl = await imageService.processAndUpload(
    req.file.buffer,
    restaurantId,
    menuItemId,
  );

  const item = await menuService.updateImageUrl(restaurantId, menuItemId, imageUrl);
  res.json(item);
}

export async function deleteImage(req: Request, res: Response) {
  const restaurantId = req.user!.restaurantId;
  const menuItemId = req.params.id as string;

  const existing = await menuService.getMenuItem(restaurantId, menuItemId);

  if (existing.imageUrl) {
    await imageService.deleteImage(existing.imageUrl).catch(() => {});
    await menuService.updateImageUrl(restaurantId, menuItemId, null);
  }

  res.status(204).end();
}
