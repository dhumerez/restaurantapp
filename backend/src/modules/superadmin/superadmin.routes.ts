import { Router } from "express";
import { z } from "zod";
import { authenticate, authorizeSuperadmin } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { validateUUID } from "../../middleware/validateUUID.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { createRestaurantSchema, updateRestaurantSchema } from "./superadmin.schema.js";
import * as superadminController from "./superadmin.controller.js";

const router = Router();

router.use(authenticate);
router.use(authorizeSuperadmin);
router.param("id", validateUUID("id"));

const assignRoleSchema = z.object({
  restaurantId: z.string().uuid(),
  role: z.enum(["admin", "waiter", "kitchen", "cashier"]),
});

router.get("/stats", asyncHandler(superadminController.getStats));
router.get("/restaurants", asyncHandler(superadminController.listRestaurants));
router.post("/restaurants", validate(createRestaurantSchema), asyncHandler(superadminController.createRestaurant));
router.get("/restaurants/:id", asyncHandler(superadminController.getRestaurant));
router.put("/restaurants/:id", validate(updateRestaurantSchema), asyncHandler(superadminController.updateRestaurant));
router.get("/restaurants/:id/users", asyncHandler(superadminController.listRestaurantUsers));
router.get("/pending-users", asyncHandler(superadminController.listPendingUsers));
router.post("/pending-users/:id/assign-role", validate(assignRoleSchema), asyncHandler(superadminController.assignRole));

export default router;
