import { Router, Request, Response } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../../config/db.js";
import { tables } from "../../db/schema.js";
import { authenticate, authorize } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { validateUUID } from "../../middleware/validateUUID.js";
import { createTableSchema, updateTableSchema } from "./tables.schema.js";
import { NotFoundError } from "../../utils/errors.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

router.use(authenticate);
router.param("id", validateUUID("id"));

// List tables
router.get("/", asyncHandler(async (req: Request, res: Response) => {
  const result = await db
    .select()
    .from(tables)
    .where(
      and(eq(tables.restaurantId, req.user!.restaurantId), eq(tables.isActive, true))
    )
    .orderBy(tables.number);
  res.json(result);
}));

// Create table (admin)
router.post("/", authorize("admin"), validate(createTableSchema), asyncHandler(async (req: Request, res: Response) => {
  const [table] = await db
    .insert(tables)
    .values({ ...req.body, restaurantId: req.user!.restaurantId })
    .returning();
  res.status(201).json(table);
}));

// Update table (admin)
router.put("/:id", authorize("admin"), validate(updateTableSchema), asyncHandler(async (req: Request, res: Response) => {
  const { number, label, seats, isActive } = req.body;
  const updates: Record<string, unknown> = {};
  if (number !== undefined) updates.number = number;
  if (label !== undefined) updates.label = label;
  if (seats !== undefined) updates.seats = seats;
  if (isActive !== undefined) updates.isActive = isActive;

  const [table] = await db
    .update(tables)
    .set(updates)
    .where(
      and(eq(tables.id, req.params.id as string), eq(tables.restaurantId, req.user!.restaurantId))
    )
    .returning();
  if (!table) throw new NotFoundError("Table not found");
  res.json(table);
}));

// Delete table (admin)
router.delete("/:id", authorize("admin"), asyncHandler(async (req: Request, res: Response) => {
  const [table] = await db
    .update(tables)
    .set({ isActive: false })
    .where(
      and(eq(tables.id, req.params.id as string), eq(tables.restaurantId, req.user!.restaurantId))
    )
    .returning();
  if (!table) throw new NotFoundError("Table not found");
  res.status(204).end();
}));

export default router;
