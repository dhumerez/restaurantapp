import client from "./client";
import type { User } from "../types";

interface LoginResponse {
  user: User;
  accessToken: string;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await client.post<LoginResponse>("/auth/login", { email, password });
  return data;
}

export async function register(name: string, email: string, password: string): Promise<{ message: string }> {
  const { data } = await client.post<{ message: string }>("/auth/register", { name, email, password });
  return data;
}

export async function verifyEmail(token: string): Promise<{ message: string }> {
  const { data } = await client.get<{ message: string }>(`/auth/verify-email?token=${encodeURIComponent(token)}`);
  return data;
}

export async function getMe(): Promise<User> {
  const { data } = await client.get<User>("/auth/me");
  return data;
}

export async function logout(): Promise<void> {
  await client.post("/auth/logout");
}
