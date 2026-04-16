import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/api/auth/get-session`,
      { credentials: "include" },
    );
    if (!res.ok) throw redirect({ to: "/login" });
    const session = await res.json();
    if (!session?.user) throw redirect({ to: "/login" });
    const role = session.user.role;
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
