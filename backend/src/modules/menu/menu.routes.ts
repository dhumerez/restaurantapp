import { Router } from "express";
import * as menuController from "./menu.controller.js";
import { authenticate, authorize } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  createCategorySchema,
  updateCategorySchema,
  createMenuItemSchema,
  updateMenuItemSchema,
  updateStockSchema,
} from "./menu.schema.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Categories
router.get("/categories", asyncHandler(menuController.listCategories));
router.post(
  "/categories",
  authorize("admin"),
  validate(createCategorySchema),
  asyncHandler(menuController.createCategory)
);
router.put(
  "/categories/:id",
  authorize("admin"),
  validate(updateCategorySchema),
  asyncHandler(menuController.updateCategory)
);
router.delete("/categories/:id", authorize("admin"), asyncHandler(menuController.deleteCategory));

// Menu Items
router.get("/menu-items", asyncHandler(menuController.listMenuItems));
router.post(
  "/menu-items",
  authorize("admin"),
  validate(createMenuItemSchema),
  asyncHandler(menuController.createMenuItem)
);
router.put(
  "/menu-items/:id",
  authorize("admin"),
  validate(updateMenuItemSchema),
  asyncHandler(menuController.updateMenuItem)
);
router.delete("/menu-items/:id", authorize("admin"), asyncHandler(menuController.deleteMenuItem));
router.patch(
  "/menu-items/:id/stock",
  authorize("admin"),
  validate(updateStockSchema),
  asyncHandler(menuController.updateStock)
);

export default router;
