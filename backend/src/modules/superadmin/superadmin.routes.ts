import { Router } from "express";
import { authenticate, authorizeSuperadmin } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { createRestaurantSchema, updateRestaurantSchema } from "./superadmin.schema.js";
import * as superadminController from "./superadmin.controller.js";

const router = Router();

router.use(authenticate);
router.use(authorizeSuperadmin);

router.get("/stats", asyncHandler(superadminController.getStats));
router.get("/restaurants", asyncHandler(superadminController.listRestaurants));
router.post("/restaurants", validate(createRestaurantSchema), asyncHandler(superadminController.createRestaurant));
router.get("/restaurants/:id", asyncHandler(superadminController.getRestaurant));
router.put("/restaurants/:id", validate(updateRestaurantSchema), asyncHandler(superadminController.updateRestaurant));
router.get("/restaurants/:id/users", asyncHandler(superadminController.listRestaurantUsers));

export default router;
