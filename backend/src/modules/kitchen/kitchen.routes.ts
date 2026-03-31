import { Router } from "express";
import * as kitchenController from "./kitchen.controller.js";
import { authenticate, authorize } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { updateItemStatusSchema, updateOrderStatusSchema } from "./kitchen.schema.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

router.use(authenticate);
router.use(authorize("kitchen", "admin"));

router.get("/orders", asyncHandler(kitchenController.getActiveOrders));
router.patch("/items/:id/status", validate(updateItemStatusSchema), asyncHandler(kitchenController.updateItemStatus));
router.patch("/orders/:id/status", validate(updateOrderStatusSchema), asyncHandler(kitchenController.updateOrderStatus));

export default router;
