import { Router, Request, Response } from "express";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcrypt";
import { db } from "../../config/db.js";
import { users } from "../../db/schema.js";
import { authenticate, authorize } from "../../middleware/auth.js";
import { NotFoundError } from "../../utils/errors.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

router.use(authenticate);
router.use(authorize("admin"));

// List staff
router.get("/staff", asyncHandler(async (req: Request, res: Response) => {
  const result = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.restaurantId, req.user!.restaurantId))
    .orderBy(users.name);
  res.json(result);
}));

// Create staff
router.post("/staff", asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body;
  const passwordHash = await bcrypt.hash(password, 12);

  const [user] = await db
    .insert(users)
    .values({
      name,
      email,
      passwordHash,
      role,
      restaurantId: req.user!.restaurantId,
    })
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    });

  res.status(201).json(user);
}));

// Update staff
router.put("/staff/:id", asyncHandler(async (req: Request, res: Response) => {
  const { name, email, role, isActive } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email;
  if (role !== undefined) updates.role = role;
  if (isActive !== undefined) updates.isActive = isActive;

  if (req.body.password) {
    updates.passwordHash = await bcrypt.hash(req.body.password, 12);
  }

  const [user] = await db
    .update(users)
    .set(updates)
    .where(
      and(
        eq(users.id, req.params.id as string),
        eq(users.restaurantId, req.user!.restaurantId)
      )
    )
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    });

  if (!user) throw new NotFoundError("User not found");
  res.json(user);
}));

// Deactivate staff
router.delete("/staff/:id", asyncHandler(async (req: Request, res: Response) => {
  const [user] = await db
    .update(users)
    .set({ isActive: false })
    .where(
      and(
        eq(users.id, req.params.id as string),
        eq(users.restaurantId, req.user!.restaurantId)
      )
    )
    .returning();

  if (!user) throw new NotFoundError("User not found");
  res.status(204).end();
}));

export default router;
