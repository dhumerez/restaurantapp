import { Router, Request, Response } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../../config/db.js";
import { tables } from "../../db/schema.js";
import { authenticate, authorize } from "../../middleware/auth.js";
import { NotFoundError } from "../../utils/errors.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

router.use(authenticate);

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
router.post("/", authorize("admin"), asyncHandler(async (req: Request, res: Response) => {
  const [table] = await db
    .insert(tables)
    .values({ ...req.body, restaurantId: req.user!.restaurantId })
    .returning();
  res.status(201).json(table);
}));

// Update table (admin)
router.put("/:id", authorize("admin"), asyncHandler(async (req: Request, res: Response) => {
  const [table] = await db
    .update(tables)
    .set(req.body)
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
