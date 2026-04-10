import { Request, Response } from "express";
import * as authService from "./auth.service.js";
import { env } from "../../config/env.js";

const REFRESH_COOKIE = {
  httpOnly: true,
  secure: env.CORS_ORIGIN.startsWith("https"),
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

export async function login(req: Request, res: Response) {
  const result = await authService.login(req.body);

  res.cookie("refreshToken", result.refreshToken, REFRESH_COOKIE);
  res.json({ user: result.user, accessToken: result.accessToken });
}

export async function register(req: Request, res: Response) {
  const result = await authService.register(req.body);
  res.status(201).json(result);
}

export async function verifyEmail(req: Request, res: Response) {
  const token = req.query.token as string | undefined;
  if (!token) {
    res.status(400).json({ error: "Token requerido" });
    return;
  }
  const result = await authService.verifyEmail(token);
  res.json(result);
}

export async function refresh(req: Request, res: Response) {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    res.status(401).json({ error: "No refresh token" });
    return;
  }
  const result = await authService.refreshAccessToken(refreshToken);
  res.json(result);
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie("refreshToken", { httpOnly: true, secure: env.CORS_ORIGIN.startsWith("https"), sameSite: "lax", path: "/" });
  res.json({ message: "Logged out" });
}

export async function getMe(req: Request, res: Response) {
  // Use jwtPayload so pending users (who have no req.user) can also call this endpoint
  const payload = req.jwtPayload!;
  const user = await authService.getMe(payload.userId, payload.scope);
  res.json(user);
}
