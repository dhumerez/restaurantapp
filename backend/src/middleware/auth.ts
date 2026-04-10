import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { UnauthorizedError, ForbiddenError } from "../utils/errors.js";

export interface RestaurantJwtPayload {
  userId: string;
  /** null for self-registered users awaiting role assignment */
  restaurantId: string | null;
  /** null for self-registered users awaiting role assignment */
  role: "admin" | "waiter" | "kitchen" | "cashier" | null;
  scope: "restaurant";
  /** Set when role/restaurantId is null to indicate pending state */
  status?: "pending_verification" | "pending_approval";
}

export interface SuperadminJwtPayload {
  userId: string;
  role: "superadmin";
  scope: "platform";
}

export type JwtPayload = RestaurantJwtPayload | SuperadminJwtPayload;

declare global {
  namespace Express {
    interface Request {
      /**
       * Set for all authenticated requests, including pending users.
       * Use this in /auth/me to read userId/scope regardless of pending state.
       */
      jwtPayload?: JwtPayload;
      /**
       * Only set for ACTIVE users (non-pending, non-platform).
       * Guaranteed to have non-null restaurantId and role for restaurant scope.
       * Use this in all business-logic routes (admin, waiter, orders, etc.).
       */
      user?: {
        userId: string;
        restaurantId: string;
        role: "admin" | "waiter" | "kitchen" | "cashier" | "superadmin";
        scope: "restaurant" | "platform";
      };
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or invalid token");
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] }) as JwtPayload;

    // Always store the full payload — allows /auth/me to work for pending users
    req.jwtPayload = payload;

    // Only populate req.user for active (non-pending) users
    // Pending users have role: null, so they'll be blocked by authorize() on any protected route
    if (payload.scope === "platform") {
      req.user = { userId: payload.userId, restaurantId: "", role: payload.role, scope: "platform" };
    } else if (payload.role && payload.restaurantId) {
      // Active restaurant user
      req.user = {
        userId: payload.userId,
        restaurantId: payload.restaurantId,
        role: payload.role,
        scope: "restaurant",
      };
    }
    // Pending users: jwtPayload is set but req.user is NOT set
    // → authorize() will throw UnauthorizedError, blocking all protected routes

    next();
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }
}

export function authorize(...roles: Array<"admin" | "waiter" | "kitchen" | "cashier">) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new UnauthorizedError();
    }
    if (!(roles as string[]).includes(req.user.role)) {
      throw new ForbiddenError("Insufficient permissions");
    }
    next();
  };
}

export function authorizeSuperadmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user || req.user.scope !== "platform") {
    throw new ForbiddenError("Superadmin access required");
  }
  next();
}
