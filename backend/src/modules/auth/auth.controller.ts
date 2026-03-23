import { Request, Response } from "express";
import * as authService from "./auth.service.js";

export async function login(req: Request, res: Response) {
  const result = await authService.login(req.body);

  res.cookie("refreshToken", result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
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
  res.clearCookie("refreshToken");
  res.json({ message: "Logged out" });
}

export async function getMe(req: Request, res: Response) {
  const user = await authService.getMe(req.user!.userId);
  res.json(user);
}
