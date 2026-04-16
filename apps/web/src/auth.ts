import { createAuthClient } from "better-auth/react";
import { anonymousClient } from "better-auth/client/plugins";

const apiBase = import.meta.env.VITE_API_URL ?? "";
export const authClient = createAuthClient({
  baseURL: apiBase ? `${apiBase}/api/auth` : "/api/auth",
  plugins: [anonymousClient()],
});

export type Session = typeof authClient.$Infer.Session;
