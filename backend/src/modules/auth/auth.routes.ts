import { Router } from "express";
import * as authController from "./auth.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/auth.js";
import { loginSchema } from "./auth.schema.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { rateLimiter } from "../../middleware/rateLimiter.js";

const router = Router();

// 10 attempts per 15 minutes per IP
const loginLimiter = rateLimiter(10, 15 * 60 * 1000, "Demasiados intentos de inicio de sesión. Intenta en 15 minutos.");

router.post("/login", loginLimiter, validate(loginSchema), asyncHandler(authController.login));
router.post("/refresh", asyncHandler(authController.refresh));
router.post("/logout", authController.logout);
router.get("/me", authenticate, asyncHandler(authController.getMe));

export default router;
