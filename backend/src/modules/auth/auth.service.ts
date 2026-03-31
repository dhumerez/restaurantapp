import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { eq, and } from "drizzle-orm";
import { db } from "../../config/db.js";
import { users } from "../../db/schema.js";
import { env } from "../../config/env.js";
import { UnauthorizedError } from "../../utils/errors.js";
import type { JwtPayload } from "../../middleware/auth.js";
import type { LoginInput } from "./auth.schema.js";

function generateTokens(payload: JwtPayload) {
  const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: "15m" });
  const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
  return { accessToken, refreshToken };
}

export async function login(input: LoginInput) {
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

  const payload: JwtPayload = {
    userId: user.id,
    restaurantId: user.restaurantId,
    role: user.role as JwtPayload["role"],
  };

  const tokens = generateTokens(payload);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      restaurantId: user.restaurantId,
    },
    ...tokens,
  };
}

export async function refreshAccessToken(refreshToken: string) {
  try {
    const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET, { algorithms: ["HS256"] }) as JwtPayload;

    // Verify user is still active
    const [user] = await db
      .select({ isActive: users.isActive, role: users.role })
      .from(users)
      .where(eq(users.id, payload.userId));

    if (!user || !user.isActive) {
      throw new UnauthorizedError("User account is deactivated");
    }

    const tokenPayload: JwtPayload = {
      userId: payload.userId,
      restaurantId: payload.restaurantId,
      role: user.role as JwtPayload["role"],
    };
    const accessToken = jwt.sign(tokenPayload, env.JWT_SECRET, { expiresIn: "15m" });
    return { accessToken };
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError("Invalid refresh token");
  }
}

export async function getMe(userId: string) {
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

  return user;
}
