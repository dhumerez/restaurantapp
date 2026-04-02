import { Router } from "express";
import multer from "multer";
import * as menuController from "./menu.controller.js";
import { authenticate, authorize } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { validateUUID } from "../../middleware/validateUUID.js";
import {
  createCategorySchema,
  updateCategorySchema,
  createMenuItemSchema,
  updateMenuItemSchema,
  updateStockSchema,
} from "./menu.schema.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

const router = Router();

// All routes require authentication
router.use(authenticate);
router.param("id", validateUUID("id"));

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

// Image upload/delete
router.post(
  "/menu-items/:id/image",
  authorize("admin"),
  upload.single("image"),
  asyncHandler(menuController.uploadImage)
);
router.delete(
  "/menu-items/:id/image",
  authorize("admin"),
  asyncHandler(menuController.deleteImage)
);

export default router;
