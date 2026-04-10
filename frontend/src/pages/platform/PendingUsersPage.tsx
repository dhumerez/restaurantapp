import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Header } from "../../components/layout/Header";
import * as superadminApi from "../../api/superadmin";

const ROLES = ["admin", "waiter", "kitchen", "cashier"] as const;
type Role = typeof ROLES[number];

export function PendingUsersPage() {
  const queryClient = useQueryClient();
  const { data: pendingUsers = [], isLoading } = useQuery({
    queryKey: ["pending-users"],
    queryFn: superadminApi.getPendingUsers,
  });
  const { data: restaurants = [] } = useQuery({
    queryKey: ["platform-restaurants"],
    queryFn: superadminApi.getRestaurants,
  });

  const [selections, setSelections] = useState<Record<string, { restaurantId: string; role: Role }>>({});

  const assignMutation = useMutation({
    mutationFn: ({ userId, restaurantId, role }: { userId: string; restaurantId: string; role: Role }) =>
      superadminApi.assignRole(userId, restaurantId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-users"] });
    },
  });

  const handleAssign = (userId: string) => {
    const sel = selections[userId];
    if (!sel?.restaurantId || !sel?.role) return;
    assignMutation.mutate({ userId, restaurantId: sel.restaurantId, role: sel.role });
  };

  const updateSelection = (userId: string, field: "restaurantId" | "role", value: string) => {
    setSelections((s) => {
      const prev = s[userId] ?? { restaurantId: "", role: "admin" as Role };
      return { ...s, [userId]: { ...prev, [field]: value } };
    });
  };

  const selectClass = "bg-surface-0 border border-surface-border rounded-lg px-3 py-1.5 text-sm text-ink-primary focus:outline-none focus:border-primary-500/50";

  return (
    <div className="flex-1 bg-surface-0">
      <Header title="Usuarios pendientes" />
      <div className="p-4 md:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
          </div>
        ) : pendingUsers.length === 0 ? (
          <div className="text-center py-16 text-ink-muted">
            <p className="text-sm">No hay usuarios pendientes de asignación.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingUsers.map((u) => {
              const sel = selections[u.id] ?? { restaurantId: "", role: "" as Role };
              const canAssign = !!sel.restaurantId && !!sel.role;
              return (
                <div key={u.id} className="bg-surface-1 border border-surface-border rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink-primary">{u.name}</p>
                    <p className="text-xs text-ink-muted">{u.email}</p>
                    <p className="text-xs text-ink-muted mt-0.5">
                      Registrado: {new Date(u.createdAt).toLocaleDateString("es-ES")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={sel.restaurantId}
                      onChange={(e) => updateSelection(u.id, "restaurantId", e.target.value)}
                      className={selectClass}
                    >
                      <option value="">Restaurante…</option>
                      {restaurants.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                    <select
                      value={sel.role}
                      onChange={(e) => updateSelection(u.id, "role", e.target.value as Role)}
                      className={selectClass}
                    >
                      <option value="">Rol…</option>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!canAssign || assignMutation.isPending}
                      onClick={() => handleAssign(u.id)}
                      className="px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
                    >
                      Asignar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
