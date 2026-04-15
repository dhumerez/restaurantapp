import { trpc } from "../trpc.js";
import { useNavigate } from "@tanstack/react-router";
import { authClient } from "../auth.js";

const roles = ["admin", "waiter", "kitchen", "cashier"] as const;
type Role = typeof roles[number];

export function DemoBanner() {
  const { data: session } = authClient.useSession();
  const navigate = useNavigate();
  const createDemo = trpc.auth.demo.create.useMutation({
    onSuccess(data) {
      navigate({ to: data.redirect });
    },
  });

  const role = (session?.user as any)?.role as Role | undefined;

  // Only show for anonymous/demo sessions
  if (!(session?.user as any)?.isAnonymous) return null;

  return (
    <div className="bg-accent text-black text-sm px-4 py-2 flex items-center justify-between flex-wrap gap-2">
      <span className="font-semibold">Modo Demo — {role}</span>
      <div className="flex gap-2">
        {roles
          .filter((r) => r !== role)
          .map((r) => (
            <button
              key={r}
              onClick={() => createDemo.mutate({ role: r })}
              className="bg-black/20 hover:bg-black/30 px-3 py-1 rounded text-xs font-medium transition-colors"
            >
              Cambiar a {r}
            </button>
          ))}
      </div>
    </div>
  );
}
