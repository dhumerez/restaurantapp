import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { trpc } from "../../../trpc.js";

export const Route = createFileRoute("/_app/platform/restaurants/$restaurantId")({
  component: RestaurantDetailPage,
});

const STATUSES = ["active", "trial", "suspended", "inactive"] as const;
const TIERS = ["free", "subscribed", "allaccess"] as const;

function statusBadgeClass(status: string) {
  switch (status) {
    case "active":
      return "bg-green-900/30 text-green-400 border-green-700";
    case "trial":
      return "bg-blue-900/30 text-blue-400 border-blue-700";
    case "suspended":
      return "bg-red-900/30 text-red-400 border-red-700";
    default:
      return "bg-gray-900/30 text-gray-400 border-gray-700";
  }
}

function RestaurantDetailPage() {
  const { restaurantId } = Route.useParams();
  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.superadmin.restaurants.get.useQuery({ id: restaurantId });
  const { data: pendingUsers = [] } = trpc.superadmin.pendingUsers.list.useQuery();

  const update = trpc.superadmin.restaurants.update.useMutation({
    onSuccess: () => utils.superadmin.restaurants.get.invalidate({ id: restaurantId }),
  });

  const assignAdmin = trpc.superadmin.restaurants.assignAdmin.useMutation({
    onSuccess: () => {
      utils.superadmin.restaurants.get.invalidate({ id: restaurantId });
      utils.superadmin.pendingUsers.list.invalidate();
      setShowAssignModal(false);
      setExistingUserId("");
      setNewUser({ email: "", name: "", password: "" });
    },
  });

  // Modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignMode, setAssignMode] = useState<"existing" | "new">("existing");
  const [existingUserId, setExistingUserId] = useState("");
  const [newUser, setNewUser] = useState({ email: "", name: "", password: "" });

  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (assignMode === "existing") {
      if (!existingUserId) return;
      assignAdmin.mutate({ restaurantId, mode: "existing", userId: existingUserId });
    } else {
      assignAdmin.mutate({ restaurantId, mode: "new", ...newUser });
    }
  };

  const openModal = () => {
    setAssignMode("existing");
    setExistingUserId("");
    setNewUser({ email: "", name: "", password: "" });
    setShowAssignModal(true);
  };

  if (isLoading) return <div className="text-muted">Cargando…</div>;
  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link to="/platform/restaurants" className="text-accent hover:underline text-sm">← Volver</Link>
        <div className="bg-surface border border-border rounded-xl p-8 text-center text-muted">
          Restaurante no encontrado.
        </div>
      </div>
    );
  }

  const { restaurant, stats, staff } = data;
  const admins = staff.filter((s) => s.role === "admin");

  return (
    <div className="space-y-6">
      <Link to="/platform/restaurants" className="text-accent hover:underline text-sm">← Volver a restaurantes</Link>

      {/* Header: name + status badge + status select + tier select */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">{restaurant.name}</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded border capitalize ${statusBadgeClass(restaurant.status)}`}>
            {restaurant.status}
          </span>
          <select
            value={restaurant.status}
            onChange={(e) => update.mutate({ id: restaurant.id, status: e.target.value as any })}
            className="bg-background border border-border rounded-lg px-2 py-1 text-sm"
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <span className="text-xs text-muted">Tier</span>
          <select
            value={restaurant.subscriptionTier ?? "free"}
            onChange={(e) => update.mutate({ id: restaurant.id, subscriptionTier: e.target.value as any })}
            className="bg-background border border-border rounded-lg px-2 py-1 text-sm"
          >
            {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Admins section */}
      <section className="bg-surface border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{admins.length === 1 ? "Admin" : "Admins"}</h2>
          {admins.length > 0 && (
            <button
              onClick={openModal}
              className="bg-accent text-black font-semibold rounded-lg px-3 py-1.5 text-xs hover:bg-accent/80"
            >
              Agregar admin
            </button>
          )}
        </div>

        {admins.length === 0 ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border border-border text-sm text-muted">
            <span>No hay admin asignado.</span>
            <button
              onClick={openModal}
              className="bg-accent text-black font-semibold rounded-lg px-3 py-1.5 text-xs hover:bg-accent/80 shrink-0"
            >
              Asignar admin
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {admins.map((a) => (
              <div key={a.id} className="flex items-center gap-3 text-sm">
                <span className="font-medium">{a.name}</span>
                <span className="text-muted">{a.email}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-surface border border-border rounded-xl p-4">
        <h2 className="font-semibold mb-3">Información</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted">Slug</dt><dd className="font-mono">{restaurant.slug}</dd>
          <dt className="text-muted">Dirección</dt><dd>{restaurant.address ?? "—"}</dd>
          <dt className="text-muted">Moneda</dt><dd>{restaurant.currency}</dd>
          <dt className="text-muted">Tasa de impuesto</dt><dd>{restaurant.taxRate}%</dd>
          <dt className="text-muted">Creado</dt><dd>{new Date(restaurant.createdAt).toLocaleDateString()}</dd>
        </dl>
      </section>

      <section className="bg-surface border border-border rounded-xl p-4">
        <h2 className="font-semibold mb-3">Estadísticas</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><div className="text-muted">Personal</div><div className="text-2xl font-bold">{stats.staffCount}</div></div>
          <div><div className="text-muted">Mesas</div><div className="text-2xl font-bold">{stats.tableCount}</div></div>
          <div><div className="text-muted">Productos</div><div className="text-2xl font-bold">{stats.menuItemCount}</div></div>
          <div><div className="text-muted">Órdenes (30d)</div><div className="text-2xl font-bold">{stats.orderCount30d}</div></div>
        </div>
      </section>

      <section className="bg-surface border border-border rounded-xl overflow-hidden">
        <h2 className="font-semibold p-4 pb-2">Personal</h2>
        {staff.length === 0 ? (
          <div className="p-4 text-muted text-sm">No hay personal asignado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-muted font-medium px-4 py-2">Nombre</th>
                <th className="text-left text-muted font-medium px-4 py-2">Correo</th>
                <th className="text-left text-muted font-medium px-4 py-2">Rol</th>
                <th className="text-left text-muted font-medium px-4 py-2">Activo</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2">{s.name}</td>
                  <td className="px-4 py-2 text-muted">{s.email}</td>
                  <td className="px-4 py-2 capitalize">{s.role}</td>
                  <td className="px-4 py-2">{s.isActive ? "Sí" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Assign Admin Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="font-semibold text-lg">Asignar admin</h2>

            {/* Mode toggle */}
            <div className="flex gap-1 p-1 bg-background rounded-lg">
              <button
                type="button"
                onClick={() => setAssignMode("existing")}
                className={`flex-1 text-sm rounded-md px-3 py-1.5 font-medium transition-colors ${
                  assignMode === "existing"
                    ? "bg-accent text-black"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Existente
              </button>
              <button
                type="button"
                onClick={() => setAssignMode("new")}
                className={`flex-1 text-sm rounded-md px-3 py-1.5 font-medium transition-colors ${
                  assignMode === "new"
                    ? "bg-accent text-black"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Nuevo
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="space-y-3">
              {assignMode === "existing" ? (
                <div>
                  <label className="block text-sm text-muted mb-1">Usuario pendiente</label>
                  <select
                    required
                    value={existingUserId}
                    onChange={(e) => setExistingUserId(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Selecciona un usuario…</option>
                    {(pendingUsers as any[]).map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.name} — {u.email}
                      </option>
                    ))}
                  </select>
                  {(pendingUsers as any[]).length === 0 && (
                    <p className="text-xs text-muted mt-1">No hay usuarios pendientes.</p>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm text-muted mb-1">Correo</label>
                    <input
                      required
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                      placeholder="admin@restaurante.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-muted mb-1">Nombre</label>
                    <input
                      required
                      type="text"
                      value={newUser.name}
                      onChange={(e) => setNewUser((u) => ({ ...u, name: e.target.value }))}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                      placeholder="Nombre completo"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-muted mb-1">Contraseña</label>
                    <input
                      required
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                      placeholder="••••••••"
                    />
                  </div>
                </>
              )}

              {assignAdmin.error && (
                <p className="text-red-400 text-xs">{assignAdmin.error.message}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="flex-1 border border-border rounded-lg px-4 py-2 text-sm hover:bg-background"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={assignAdmin.isPending}
                  className="flex-1 bg-accent text-black font-semibold rounded-lg px-4 py-2 text-sm hover:bg-accent/80 disabled:opacity-50"
                >
                  {assignAdmin.isPending ? "Asignando…" : "Asignar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
