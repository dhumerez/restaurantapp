import { Router } from "express";
import * as kitchenController from "./kitchen.controller.js";
import { authenticate, authorize } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

router.use(authenticate);
router.use(authorize("kitchen", "admin"));

router.get("/orders", asyncHandler(kitchenController.getActiveOrders));
router.patch("/items/:id/status", asyncHandler(kitchenController.updateItemStatus));
router.patch("/orders/:id/status", asyncHandler(kitchenController.updateOrderStatus));

export default router;
