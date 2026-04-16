import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { authClient } from "../auth.js";
import { AppShell } from "../components/AppShell.js";
import { useSubscriptions } from "../hooks/useSubscriptions.js";
import { usePushSubscription } from "../hooks/usePushSubscription.js";

function AppLayout() {
  useSubscriptions();
  usePushSubscription();

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export const Route = createFileRoute("/_app")({
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
  },
  component: AppLayout,
});
