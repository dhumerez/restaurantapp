import { Request, Response } from "express";
import * as authService from "./auth.service.js";
import { env } from "../../config/env.js";

export async function login(req: Request, res: Response) {
  const result = await authService.login(req.body);

  res.cookie("refreshToken", result.refreshToken, {
    httpOnly: true,
    secure: env.CORS_ORIGIN.startsWith("https"),
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
  });

  res.json({
    user: result.user,
    accessToken: result.accessToken,
  });
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
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: env.CORS_ORIGIN.startsWith("https"),
    sameSite: "lax",
    path: "/",
  });
  res.json({ message: "Logged out" });
}

export async function getMe(req: Request, res: Response) {
  const user = await authService.getMe(req.user!.userId, req.user!.scope);
  res.json(user);
}
