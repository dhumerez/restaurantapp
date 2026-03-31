import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Header } from "../../components/layout/Header";
import * as superadminApi from "../../api/superadmin";

const statusOptions = [
  { value: "active", label: "Activo", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  { value: "trial", label: "Prueba", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { value: "suspended", label: "Suspendido", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { value: "inactive", label: "Inactivo", color: "bg-red-500/10 text-red-400 border-red-500/20" },
];

export function RestaurantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: restaurant, isLoading } = useQuery({
    queryKey: ["platform-restaurant", id],
    queryFn: () => superadminApi.getRestaurant(id!),
    enabled: !!id,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["platform-restaurant-users", id],
    queryFn: () => superadminApi.getRestaurantUsers(id!),
    enabled: !!id,
  });

  const [editForm, setEditForm] = useState({
    name: "",
    address: "",
    currency: "",
    taxRate: "",
  });

  const updateMutation = useMutation({
    mutationFn: (input: Parameters<typeof superadminApi.updateRestaurant>[1]) =>
      superadminApi.updateRestaurant(id!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-restaurant", id] });
      queryClient.invalidateQueries({ queryKey: ["platform-restaurants"] });
      setEditing(false);
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => superadminApi.updateRestaurant(id!, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-restaurant", id] });
      queryClient.invalidateQueries({ queryKey: ["platform-restaurants"] });
    },
  });

  const startEditing = () => {
    if (!restaurant) return;
    setEditForm({
      name: restaurant.name,
      address: restaurant.address ?? "",
      currency: restaurant.currency,
      taxRate: restaurant.taxRate,
    });
    setEditing(true);
  };

  const handleSave = () => {
    updateMutation.mutate(editForm);
  };

  if (isLoading) {
    return (
      <div className="flex-1 bg-surface-0">
        <Header title="Restaurante" />
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="flex-1 bg-surface-0">
        <Header title="Restaurante" />
        <div className="p-6 text-center text-ink-muted">Restaurante no encontrado</div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-surface-0">
      <Header title={restaurant.name} />
      <div className="p-4 md:p-6 max-w-4xl">
        {/* Back link */}
        <Link to="/platform/restaurants" className="text-xs text-ink-muted hover:text-primary-400 transition-colors mb-4 inline-block">
          &larr; Volver a restaurantes
        </Link>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6">
          <StatCard label="Usuarios" value={restaurant.userCount.toString()} />
          <StatCard label="Pedidos totales" value={restaurant.totalOrders.toString()} />
          <StatCard label="Ingresos totales" value={`$ ${parseFloat(restaurant.totalRevenue).toFixed(2)}`} />
        </div>

        {/* Restaurant info */}
        <div className="bg-surface-1 border border-surface-border rounded-2xl p-4 md:p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-ink-primary uppercase tracking-wider">Informacion</h3>
            {!editing ? (
              <button
                onClick={startEditing}
                className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
              >
                Editar
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="text-xs text-ink-muted hover:text-ink-primary transition-colors">
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={updateMutation.isPending} className="text-xs text-primary-400 hover:text-primary-300 transition-colors disabled:opacity-50">
                  {updateMutation.isPending ? "Guardando..." : "Guardar"}
                </button>
              </div>
            )}
          </div>

          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-ink-muted mb-1">Nombre</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-surface-0 border border-surface-border rounded-lg text-sm text-ink-primary focus:outline-none focus:border-primary-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-muted mb-1">Direccion</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                  className="w-full px-3 py-2 bg-surface-0 border border-surface-border rounded-lg text-sm text-ink-primary focus:outline-none focus:border-primary-500/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-ink-muted mb-1">Moneda</label>
                  <input
                    type="text"
                    maxLength={3}
                    value={editForm.currency}
                    onChange={(e) => setEditForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 bg-surface-0 border border-surface-border rounded-lg text-sm text-ink-primary font-mono focus:outline-none focus:border-primary-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-muted mb-1">Impuesto (%)</label>
                  <input
                    type="text"
                    value={editForm.taxRate}
                    onChange={(e) => setEditForm((f) => ({ ...f, taxRate: e.target.value }))}
                    className="w-full px-3 py-2 bg-surface-0 border border-surface-border rounded-lg text-sm text-ink-primary font-mono focus:outline-none focus:border-primary-500/50"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-y-3 text-sm">
              <div className="text-ink-muted">Nombre</div>
              <div className="text-ink-primary font-medium">{restaurant.name}</div>
              <div className="text-ink-muted">Slug</div>
              <div className="text-ink-primary font-mono text-xs">/{restaurant.slug}</div>
              <div className="text-ink-muted">Direccion</div>
              <div className="text-ink-primary">{restaurant.address || "—"}</div>
              <div className="text-ink-muted">Moneda</div>
              <div className="text-ink-primary font-mono">{restaurant.currency}</div>
              <div className="text-ink-muted">Impuesto</div>
              <div className="text-ink-primary font-mono">{restaurant.taxRate}%</div>
              <div className="text-ink-muted">Creado</div>
              <div className="text-ink-primary">{new Date(restaurant.createdAt).toLocaleDateString()}</div>
            </div>
          )}
        </div>

        {/* Status management */}
        <div className="bg-surface-1 border border-surface-border rounded-2xl p-4 md:p-6 mb-4">
          <h3 className="text-sm font-semibold text-ink-primary uppercase tracking-wider mb-4">Estado</h3>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => statusMutation.mutate(opt.value)}
                disabled={statusMutation.isPending || restaurant.status === opt.value}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50
                  ${restaurant.status === opt.value
                    ? opt.color + " ring-1 ring-current"
                    : "border-surface-border text-ink-muted hover:text-ink-primary hover:border-ink-muted"
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Staff list */}
        <div className="bg-surface-1 border border-surface-border rounded-2xl overflow-hidden">
          <div className="px-4 md:px-6 py-3 md:py-4 border-b border-surface-border">
            <h3 className="text-sm font-semibold text-ink-primary uppercase tracking-wider">
              Personal ({users.length})
            </h3>
          </div>
          {users.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-ink-muted">Sin usuarios</div>
          ) : (
            <div className="divide-y divide-surface-border">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between px-4 md:px-6 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary-500/10 border border-primary-500/15 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-primary-400">
                        {u.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-primary truncate">{u.name}</p>
                      <p className="text-xs text-ink-muted truncate">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <RoleBadge role={u.role} />
                    {!u.isActive && (
                      <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                        Inactivo
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-1 border border-surface-border rounded-2xl p-4">
      <p className="text-xs font-medium text-ink-muted uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-bold font-mono tabular-nums text-ink-primary">{value}</p>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    admin:   "bg-primary-500/10 text-primary-400 border-primary-500/20",
    waiter:  "bg-blue-500/10 text-blue-400 border-blue-500/20",
    kitchen: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  };

  const labels: Record<string, string> = {
    admin: "Admin",
    waiter: "Mesero",
    kitchen: "Cocina",
  };

  return (
    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${styles[role] ?? "bg-surface-2 text-ink-muted border-surface-border"}`}>
      {labels[role] ?? role}
    </span>
  );
}
