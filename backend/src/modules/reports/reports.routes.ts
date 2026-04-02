import { Router } from "express";
import * as reportsController from "./reports.controller.js";
import { authenticate, authorize } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

router.use(authenticate);
router.use(authorize("admin"));

router.get("/summary", asyncHandler(reportsController.getSummary));
router.get("/top-items", asyncHandler(reportsController.getTopItems));
router.get("/revenue-by-period", asyncHandler(reportsController.getRevenueByPeriod));
router.get("/by-waiter", asyncHandler(reportsController.getByWaiter));
router.get("/by-hour", asyncHandler(reportsController.getByHour));

export default router;
