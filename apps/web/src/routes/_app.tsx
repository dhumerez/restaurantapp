import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "../components/AppShell.js";
import { useSessionStore } from "../store/sessionStore.js";
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

async function fetchSession() {
  const res = await fetch(
    `${import.meta.env.VITE_API_URL ?? ""}/api/auth/get-session`,
    { credentials: "include" },
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data?.user ? data : null;
}

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const session = await fetchSession();
    if (!session?.user) throw redirect({ to: "/login" });
    const role = session.user.role;
    if (!role) throw redirect({ to: "/pending" });

    if (role !== "superadmin") {
      // Fetch restaurant status for lockout check
      const res = await fetch(
        `${import.meta.env.VITE_API_URL ?? ""}/api/trpc/me.context?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": { json: null } }))}`,
        { credentials: "include" },
      );
      if (res.ok) {
        const payload = await res.json();
        const status = payload?.[0]?.result?.data?.json?.restaurantStatus;
        const ALLOWED = new Set(["active", "trial", "demo"]);
        if (status === null || !ALLOWED.has(status)) {
          throw redirect({ to: "/restaurant-inactive" });
        }
      }
    }

    useSessionStore.getState().setSession(session);
  },
  component: AppLayout,
});
