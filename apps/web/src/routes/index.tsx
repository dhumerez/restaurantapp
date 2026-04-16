import { createFileRoute, redirect } from "@tanstack/react-router";
import { authClient } from "../auth.js";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession({
      query: { disableCookieCache: true },
    });
    if (!session?.user) throw redirect({ to: "/login" });
    const role = (session.user as any).role;
    if (!role) throw redirect({ to: "/pending" });
    if (role === "superadmin") throw redirect({ to: "/platform/restaurants" });
    if (role === "waiter") throw redirect({ to: "/waiter/tables" });
    if (role === "kitchen") throw redirect({ to: "/kitchen" });
    if (role === "cashier") throw redirect({ to: "/cashier/tables" });
    if (role === "admin") throw redirect({ to: "/admin" });
    throw redirect({ to: "/login" });
  },
  component: () => null,
});
