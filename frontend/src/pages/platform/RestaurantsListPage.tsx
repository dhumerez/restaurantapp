import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Header } from "../../components/layout/Header";
import * as superadminApi from "../../api/superadmin";

export function RestaurantsListPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: restaurants = [] } = useQuery({
    queryKey: ["platform-restaurants"],
    queryFn: superadminApi.getRestaurants,
  });

  const filtered = restaurants.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.slug.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex-1 bg-surface-0">
      <Header title="Restaurantes" />
      <div className="p-4 md:p-6 max-w-6xl">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4 md:mb-6">
          <input
            type="text"
            placeholder="Buscar restaurante..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-3 py-2 bg-surface-1 border border-surface-border rounded-lg text-sm text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-primary-500/50"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-surface-1 border border-surface-border rounded-lg text-sm text-ink-primary focus:outline-none focus:border-primary-500/50"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activo</option>
            <option value="trial">Prueba</option>
            <option value="suspended">Suspendido</option>
            <option value="inactive">Inactivo</option>
          </select>
          <Link
            to="/platform/restaurants/new"
            className="px-4 py-2 bg-primary-500 text-surface-0 text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors text-center"
          >
            + Nuevo restaurante
          </Link>
        </div>

        {/* Table */}
        <div className="bg-surface-1 border border-surface-border rounded-2xl overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="text-left px-6 py-3 text-xs font-medium text-ink-muted uppercase tracking-wider">Restaurante</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-ink-muted uppercase tracking-wider">Slug</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-ink-muted uppercase tracking-wider">Usuarios</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-ink-muted uppercase tracking-wider">Moneda</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-ink-muted uppercase tracking-wider">Estado</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-ink-muted uppercase tracking-wider">Creado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-2/50 transition-colors">
                    <td className="px-6 py-3">
                      <Link to={`/platform/restaurants/${r.id}`} className="text-sm font-medium text-ink-primary hover:text-primary-400 transition-colors">
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-ink-muted font-mono text-xs">/{r.slug}</td>
                    <td className="px-6 py-3 text-ink-secondary">{r.userCount ?? 0}</td>
                    <td className="px-6 py-3 text-ink-secondary">{r.currency}</td>
                    <td className="px-6 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-6 py-3 text-ink-muted text-xs">{new Date(r.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile list */}
          <div className="md:hidden divide-y divide-surface-border">
            {filtered.map((r) => (
              <Link
                key={r.id}
                to={`/platform/restaurants/${r.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-surface-2/50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-primary truncate">{r.name}</p>
                  <p className="text-xs text-ink-muted">/{r.slug} &middot; {r.userCount ?? 0} usuarios</p>
                </div>
                <StatusBadge status={r.status} />
              </Link>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-ink-muted">No se encontraron restaurantes</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active:    "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    trial:     "bg-blue-500/10 text-blue-400 border-blue-500/20",
    suspended: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    inactive:  "bg-red-500/10 text-red-400 border-red-500/20",
  };

  const labels: Record<string, string> = {
    active: "Activo",
    trial: "Prueba",
    suspended: "Suspendido",
    inactive: "Inactivo",
  };

  return (
    <span className={`px-2.5 py-1 text-[10px] md:text-xs font-medium rounded-full border ${styles[status] ?? "bg-surface-2 text-ink-muted border-surface-border"}`}>
      {labels[status] ?? status}
    </span>
  );
}
