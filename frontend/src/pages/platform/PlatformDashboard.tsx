import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Header } from "../../components/layout/Header";
import * as superadminApi from "../../api/superadmin";

export function PlatformDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: superadminApi.getStats,
  });

  const { data: restaurants = [] } = useQuery({
    queryKey: ["platform-restaurants"],
    queryFn: superadminApi.getRestaurants,
  });

  return (
    <div className="flex-1 bg-surface-0">
      <Header title="Plataforma" />
      <div className="p-4 md:p-6 max-w-6xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
          <StatCard
            label="Restaurantes"
            value={stats?.totalRestaurants?.toString() ?? "0"}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
          />
          <StatCard
            label="Usuarios activos"
            value={stats?.activeUsers?.toString() ?? "0"}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            }
          />
          <StatCard
            label="Pedidos de hoy"
            value={stats?.todayOrders?.toString() ?? "0"}
            accent
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            }
          />
          <StatCard
            label="Ingresos de hoy"
            value={`$ ${parseFloat(stats?.todayRevenue ?? "0").toFixed(2)}`}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        </div>

        {/* Recent restaurants */}
        <div className="bg-surface-1 border border-surface-border rounded-2xl overflow-hidden">
          <div className="px-4 md:px-6 py-3 md:py-4 border-b border-surface-border flex items-center justify-between">
            <h3 className="font-display text-base md:text-lg font-semibold text-ink-primary tracking-wide">Restaurantes</h3>
            <Link
              to="/platform/restaurants/new"
              className="px-3 py-1.5 bg-primary-500 text-surface-0 text-xs font-medium rounded-lg hover:bg-primary-600 transition-colors"
            >
              + Nuevo
            </Link>
          </div>
          {restaurants.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <svg className="w-12 h-12 text-ink-muted mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <p className="text-sm text-ink-muted">No hay restaurantes aún</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-border">
              {restaurants.map((r) => (
                <Link
                  key={r.id}
                  to={`/platform/restaurants/${r.id}`}
                  className="flex items-center justify-between px-4 md:px-6 py-3 md:py-3.5 hover:bg-surface-2/50 transition-colors"
                >
                  <div className="flex items-center gap-3 md:gap-4 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-primary-500/10 border border-primary-500/15 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary-400">
                        {r.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-primary truncate">{r.name}</p>
                      <p className="text-xs text-ink-muted">/{r.slug} &middot; {r.userCount ?? 0} usuarios</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={r.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`bg-surface-1 border rounded-2xl p-4 md:p-5 ${accent ? "border-primary-500/30 bg-primary-500/5" : "border-surface-border"}`}>
      <div className="flex items-center justify-between mb-2 md:mb-3">
        <p className="text-xs font-medium text-ink-muted uppercase tracking-widest">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent ? "bg-primary-500/15 text-primary-400" : "bg-surface-2 text-ink-muted"}`}>
          {icon}
        </div>
      </div>
      <p className={`text-2xl md:text-3xl font-bold font-mono tabular-nums ${accent ? "text-primary-400" : "text-ink-primary"}`}>
        {value}
      </p>
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
    <span className={`px-2 md:px-2.5 py-1 text-[10px] md:text-xs font-medium rounded-full border ${styles[status] ?? "bg-surface-2 text-ink-muted border-surface-border"}`}>
      {labels[status] ?? status}
    </span>
  );
}
