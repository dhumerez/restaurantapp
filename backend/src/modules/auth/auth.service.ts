import jwt from "jsonwebtoken";
import { eq, and, isNull } from "drizzle-orm";
import { hashPassword, verifyPassword, DUMMY_HASH, generateRawToken, hashToken } from "@shared/auth-utils";
import { db } from "../../config/db.js";
import { users, superadmins, restaurants, verificationTokens } from "../../db/schema.js";
import { env } from "../../config/env.js";
import { UnauthorizedError, AppError } from "../../utils/errors.js";
import { sendVerificationEmail } from "../../utils/email.js";
import type { JwtPayload, RestaurantJwtPayload, SuperadminJwtPayload } from "../../middleware/auth.js";
import type { LoginInput, RegisterInput } from "./auth.schema.js";

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function generateTokens(payload: JwtPayload) {
  const accessToken = jwt.sign(payload as object, env.JWT_SECRET, { expiresIn: "15m" });
  const refreshToken = jwt.sign(payload as object, env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
  return { accessToken, refreshToken };
}

export async function login(input: LoginInput) {
  // Try superadmin first
  const [sa] = await db
    .select()
    .from(superadmins)
    .where(and(eq(superadmins.email, input.email), eq(superadmins.isActive, true)));

  if (sa) {
    const valid = await verifyPassword(input.password, sa.passwordHash);
    if (!valid) throw new UnauthorizedError("Invalid email or password");

    const payload: SuperadminJwtPayload = {
      userId: sa.id,
      role: "superadmin",
      scope: "platform",
    };

    const tokens = generateTokens(payload);
    return {
      user: { id: sa.id, name: sa.name, email: sa.email, role: "superadmin" as const, scope: "platform" as const },
      ...tokens,
    };
  }

  // Fall through to restaurant user (includes pending self-registered users)
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, input.email), eq(users.isActive, true)));

  // Always run hash comparison to avoid timing oracle on user enumeration
  const passwordHash = user?.passwordHash ?? DUMMY_HASH;
  const valid = await verifyPassword(input.password, passwordHash);

  if (!user || !valid) throw new UnauthorizedError("Invalid email or password");

  // Determine user status
  if (!user.isEmailVerified) {
    const payload: RestaurantJwtPayload = { userId: user.id, restaurantId: null, role: null, scope: "restaurant", status: "pending_verification" };
    const tokens = generateTokens(payload);
    return {
      user: { id: user.id, name: user.name, email: user.email, role: null, restaurantId: null, scope: "restaurant" as const, status: "pending_verification" as const },
      ...tokens,
    };
  }

  if (!user.role || !user.restaurantId) {
    const payload: RestaurantJwtPayload = { userId: user.id, restaurantId: null, role: null, scope: "restaurant", status: "pending_approval" };
    const tokens = generateTokens(payload);
    return {
      user: { id: user.id, name: user.name, email: user.email, role: null, restaurantId: null, scope: "restaurant" as const, status: "pending_approval" as const },
      ...tokens,
    };
  }

  // Active user with role and restaurant
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
    user: { id: user.id, name: user.name, email: user.email, role: user.role, restaurantId: user.restaurantId, scope: "restaurant" as const },
    ...tokens,
  };
}

export async function register(input: RegisterInput) {
  // Check email not already taken (in any context)
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  if (existing) {
    throw new AppError(409, "Este correo ya está registrado");
  }

  const passwordHash = await hashPassword(input.password);

  const [newUser] = await db
    .insert(users)
    .values({
      name: input.name,
      email: input.email,
      passwordHash,
      isEmailVerified: false,
      isActive: true,
    })
    .returning({ id: users.id, name: users.name, email: users.email });

  // Create verification token
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

  await db.insert(verificationTokens).values({ userId: newUser.id, tokenHash, expiresAt });

  // Send verification email (fire-and-forget — don't fail registration if email fails)
  sendVerificationEmail(newUser.email, newUser.name, rawToken).catch((err) => {
    console.error("[register] Failed to send verification email:", err);
  });

  return { message: "Registro exitoso. Revisa tu correo para verificar tu cuenta." };
}

export async function verifyEmail(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const now = new Date();

  const [token] = await db
    .select()
    .from(verificationTokens)
    .where(and(eq(verificationTokens.tokenHash, tokenHash), isNull(verificationTokens.usedAt)))
    .limit(1);

  if (!token || token.expiresAt < now) {
    throw new AppError(400, "El enlace de verificación es inválido o ha expirado");
  }

  // Mark token as used and mark user as verified
  await Promise.all([
    db.update(verificationTokens).set({ usedAt: now }).where(eq(verificationTokens.id, token.id)),
    db.update(users).set({ isEmailVerified: true }).where(eq(users.id, token.userId)),
  ]);

  return { message: "Correo verificado exitosamente" };
}

export async function refreshAccessToken(refreshToken: string) {
  try {
    const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET, { algorithms: ["HS256"] }) as JwtPayload;

    if (payload.scope === "platform") {
      const [sa] = await db
        .select({ isActive: superadmins.isActive })
        .from(superadmins)
        .where(eq(superadmins.id, payload.userId));

      if (!sa || !sa.isActive) throw new UnauthorizedError("Account is deactivated");

      const tokenPayload: SuperadminJwtPayload = { userId: payload.userId, role: "superadmin", scope: "platform" };
      const accessToken = jwt.sign(tokenPayload as object, env.JWT_SECRET, { expiresIn: "15m" });
      return { accessToken };
    }

    // Restaurant user refresh
    const [user] = await db
      .select({ isActive: users.isActive, role: users.role, restaurantId: users.restaurantId, isEmailVerified: users.isEmailVerified })
      .from(users)
      .where(eq(users.id, payload.userId));

    if (!user || !user.isActive) throw new UnauthorizedError("User account is deactivated");

    // Re-check pending status
    if (!user.isEmailVerified) {
      const tokenPayload: RestaurantJwtPayload = { userId: payload.userId, restaurantId: null, role: null, scope: "restaurant", status: "pending_verification" };
      const accessToken = jwt.sign(tokenPayload as object, env.JWT_SECRET, { expiresIn: "15m" });
      return { accessToken };
    }

    if (!user.role || !user.restaurantId) {
      const tokenPayload: RestaurantJwtPayload = { userId: payload.userId, restaurantId: null, role: null, scope: "restaurant", status: "pending_approval" };
      const accessToken = jwt.sign(tokenPayload as object, env.JWT_SECRET, { expiresIn: "15m" });
      return { accessToken };
    }

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
    const accessToken = jwt.sign(tokenPayload as object, env.JWT_SECRET, { expiresIn: "15m" });
    return { accessToken };
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError("Invalid refresh token");
  }
}

export async function getMe(userId: string, scope: "restaurant" | "platform") {
  if (scope === "platform") {
    const [sa] = await db
      .select({ id: superadmins.id, name: superadmins.name, email: superadmins.email })
      .from(superadmins)
      .where(eq(superadmins.id, userId));

    if (!sa) throw new UnauthorizedError("User not found");
    return { ...sa, role: "superadmin" as const, scope: "platform" as const };
  }

  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, restaurantId: users.restaurantId, isEmailVerified: users.isEmailVerified })
    .from(users)
    .where(eq(users.id, userId));

  if (!user) throw new UnauthorizedError("User not found");

  const status = !user.isEmailVerified
    ? "pending_verification"
    : (!user.role || !user.restaurantId)
      ? "pending_approval"
      : "active";

  return { ...user, scope: "restaurant" as const, status };
}
