import { Router } from "express";
import * as ordersController from "./orders.controller.js";
import { authenticate, authorize } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { validateUUID } from "../../middleware/validateUUID.js";
import { createOrderSchema, updateOrderSchema, applyDiscountSchema } from "./orders.schema.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

router.use(authenticate);
router.param("id", validateUUID("id"));

router.get("/", asyncHandler(ordersController.listOrders));
router.get("/:id", asyncHandler(ordersController.getOrder));
router.post(
  "/",
  authorize("waiter", "admin"),
  validate(createOrderSchema),
  asyncHandler(ordersController.createOrder)
);
router.put(
  "/:id",
  authorize("waiter", "admin"),
  validate(updateOrderSchema),
  asyncHandler(ordersController.updateOrder)
);
router.post("/:id/place", authorize("waiter", "admin"), asyncHandler(ordersController.placeOrder));
router.patch(
  "/:id/discount",
  authorize("admin", "cashier", "waiter"),
  validate(applyDiscountSchema),
  asyncHandler(ordersController.applyDiscount)
);
router.patch("/:id/serve", authorize("waiter", "admin", "cashier"), asyncHandler(ordersController.serveOrder));
router.patch(
  "/:id/cancel",
  authorize("waiter", "admin", "cashier"),
  asyncHandler(ordersController.cancelOrder)
);

export default router;
