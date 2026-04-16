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
    `${import.meta.env.VITE_API_URL}/api/auth/get-session`,
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
    useSessionStore.getState().setSession(session);
  },
  component: AppLayout,
});
