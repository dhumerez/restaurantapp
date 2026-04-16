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
    const { data: session } = await authClient.getSession({
      query: { disableCookieCache: true },
    });
    if (!session?.user) throw redirect({ to: "/login" });
    const role = (session.user as any).role;
    if (!role) throw redirect({ to: "/pending" });
  },
  component: AppLayout,
});
