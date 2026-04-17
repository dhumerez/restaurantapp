import { createFileRoute, Link } from "@tanstack/react-router";
import { trpc } from "../../../trpc.js";

export const Route = createFileRoute("/_app/platform/restaurants/$restaurantId")({
  component: RestaurantDetailPage,
});

const STATUSES = ["active", "trial", "suspended", "inactive"] as const;

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
  const update = trpc.superadmin.restaurants.update.useMutation({
    onSuccess: () => utils.superadmin.restaurants.get.invalidate({ id: restaurantId }),
  });

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

  return (
    <div className="space-y-6">
      <Link to="/platform/restaurants" className="text-accent hover:underline text-sm">← Volver a restaurantes</Link>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">{restaurant.name}</h1>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

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
    </div>
  );
}
