import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { UnauthorizedError, ForbiddenError } from "../utils/errors.js";

export interface RestaurantJwtPayload {
  userId: string;
  restaurantId: string;
  role: "admin" | "waiter" | "kitchen" | "cashier";
  scope: "restaurant";
}

export interface SuperadminJwtPayload {
  userId: string;
  role: "superadmin";
  scope: "platform";
}

export type JwtPayload = RestaurantJwtPayload | SuperadminJwtPayload;

// Express req.user uses a broad interface so existing restaurant-scoped routes
// (all guarded by authorize("admin"|"waiter"|"kitchen")) work without changes.
// Superadmin routes use authorizeSuperadmin and never access restaurantId.
declare global {
  namespace Express {
    interface Request {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    req.user = payload as any;
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
