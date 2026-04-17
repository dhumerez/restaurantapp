import { createAuthClient } from "better-auth/react";
import { anonymousClient } from "better-auth/client/plugins";

const apiBase =
  import.meta.env.VITE_API_URL ??
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:5173");
export const authClient = createAuthClient({
  baseURL: `${apiBase}/api/auth`,
  plugins: [anonymousClient()],
});

export type Session = typeof authClient.$Infer.Session;
