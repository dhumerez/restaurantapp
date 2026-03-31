import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { eq, and } from "drizzle-orm";
import { db } from "../../config/db.js";
import { users, superadmins, restaurants } from "../../db/schema.js";
import { env } from "../../config/env.js";
import { UnauthorizedError } from "../../utils/errors.js";
import type { JwtPayload, RestaurantJwtPayload, SuperadminJwtPayload } from "../../middleware/auth.js";
import type { LoginInput } from "./auth.schema.js";

function generateTokens(payload: JwtPayload) {
  const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: "15m" });
  const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
  return { accessToken, refreshToken };
}

export async function login(input: LoginInput) {
  // Try superadmin first
  const [sa] = await db
    .select()
    .from(superadmins)
    .where(and(eq(superadmins.email, input.email), eq(superadmins.isActive, true)));

  if (sa) {
    const valid = await bcrypt.compare(input.password, sa.passwordHash);
    if (!valid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const payload: SuperadminJwtPayload = {
      userId: sa.id,
      role: "superadmin",
      scope: "platform",
    };

    const tokens = generateTokens(payload);

    return {
      user: {
        id: sa.id,
        name: sa.name,
        email: sa.email,
        role: "superadmin" as const,
        scope: "platform" as const,
      },
      ...tokens,
    };
  }

  // Fall through to restaurant user
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, input.email), eq(users.isActive, true)));

  if (!user) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError("Invalid email or password");
  }

  // Check restaurant status
  const [restaurant] = await db
    .select({ status: restaurants.status })
    .from(restaurants)
    .where(eq(restaurants.id, user.restaurantId));

  if (!restaurant || restaurant.status === "suspended" || restaurant.status === "inactive") {
    throw new UnauthorizedError("Restaurant account is suspended");
  }

  const payload: RestaurantJwtPayload = {
    userId: user.id,
    restaurantId: user.restaurantId,
    role: user.role as RestaurantJwtPayload["role"],
    scope: "restaurant",
  };

  const tokens = generateTokens(payload);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      restaurantId: user.restaurantId,
      scope: "restaurant" as const,
    },
    ...tokens,
  };
}

export async function refreshAccessToken(refreshToken: string) {
  try {
    const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET, { algorithms: ["HS256"] }) as JwtPayload;

    if (payload.scope === "platform") {
      // Superadmin refresh
      const [sa] = await db
        .select({ isActive: superadmins.isActive })
        .from(superadmins)
        .where(eq(superadmins.id, payload.userId));

      if (!sa || !sa.isActive) {
        throw new UnauthorizedError("Account is deactivated");
      }

      const tokenPayload: SuperadminJwtPayload = {
        userId: payload.userId,
        role: "superadmin",
        scope: "platform",
      };
      const accessToken = jwt.sign(tokenPayload, env.JWT_SECRET, { expiresIn: "15m" });
      return { accessToken };
    }

    // Restaurant user refresh
    const [user] = await db
      .select({ isActive: users.isActive, role: users.role, restaurantId: users.restaurantId })
      .from(users)
      .where(eq(users.id, payload.userId));

    if (!user || !user.isActive) {
      throw new UnauthorizedError("User account is deactivated");
    }

    // Check restaurant status on refresh too
    const [restaurant] = await db
      .select({ status: restaurants.status })
      .from(restaurants)
      .where(eq(restaurants.id, user.restaurantId));

    if (!restaurant || restaurant.status === "suspended" || restaurant.status === "inactive") {
      throw new UnauthorizedError("Restaurant account is suspended");
    }

    const tokenPayload: RestaurantJwtPayload = {
      userId: payload.userId,
      restaurantId: payload.restaurantId,
      role: user.role as RestaurantJwtPayload["role"],
      scope: "restaurant",
    };
    const accessToken = jwt.sign(tokenPayload, env.JWT_SECRET, { expiresIn: "15m" });
    return { accessToken };
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError("Invalid refresh token");
  }
}

export async function getMe(userId: string, scope: "restaurant" | "platform") {
  if (scope === "platform") {
    const [sa] = await db
      .select({
        id: superadmins.id,
        name: superadmins.name,
        email: superadmins.email,
      })
      .from(superadmins)
      .where(eq(superadmins.id, userId));

    if (!sa) {
      throw new UnauthorizedError("User not found");
    }

    return { ...sa, role: "superadmin" as const, scope: "platform" as const };
  }

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      restaurantId: users.restaurantId,
    })
    .from(users)
    .where(eq(users.id, userId));

  if (!user) {
    throw new UnauthorizedError("User not found");
  }

  return { ...user, scope: "restaurant" as const };
}
