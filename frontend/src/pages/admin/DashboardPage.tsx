import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getOrders } from "../../api/orders";
import { Header } from "../../components/layout/Header";
import { ordenEstado } from "../../utils/labels";
import { HiOutlineUsers, HiOutlineTable } from "react-icons/hi";

export function DashboardPage() {
  const { data: orders = [], isPending: ordersPending, isFetching: ordersFetching } = useQuery({
    queryKey: ["orders"],
    queryFn: () => getOrders(),
    staleTime: 30000,
  });

  const todayOrders = orders.filter((o) => {
    const orderDate = new Date(o.createdAt).toDateString();
    return orderDate === new Date().toDateString();
  });

  const todayRevenue = todayOrders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + parseFloat(o.total), 0);

  const activeOrders = orders.filter(
    (o) => o.status === "placed" || o.status === "preparing"
  );

  return (
    <div className="flex-1 bg-surface-0">
      <Header title="Panel" />
      <div className="p-4 md:p-6 max-w-6xl">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
          <StatCard
            label="Pedidos de hoy"
            value={todayOrders.length.toString()}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            }
          />
          <StatCard
            label="Pedidos activos"
            value={activeOrders.length.toString()}
            accent
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            label="Ingresos de hoy"
            value={`Bs. ${todayRevenue.toFixed(2)}`}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        </div>

        {/* Admin shortcuts */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 mb-6 md:mb-8">
          <Link
            to="/admin/staff"
            className="flex items-center gap-3 bg-surface-1 border border-surface-border rounded-2xl p-4 md:p-5 hover:bg-surface-2/50 hover:border-primary-500/20 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/15 flex items-center justify-center shrink-0 group-hover:bg-blue-500/15 transition-colors">
              <HiOutlineUsers className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink-primary">Personal</p>
              <p className="text-xs text-ink-muted">Gestionar empleados</p>
            </div>
          </Link>
          <Link
            to="/admin/tables"
            className="flex items-center gap-3 bg-surface-1 border border-surface-border rounded-2xl p-4 md:p-5 hover:bg-surface-2/50 hover:border-primary-500/20 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/15 flex items-center justify-center shrink-0 group-hover:bg-amber-500/15 transition-colors">
              <HiOutlineTable className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink-primary">Mesas</p>
              <p className="text-xs text-ink-muted">Gestionar mesas</p>
            </div>
          </Link>
        </div>

        <div className="bg-surface-1 border border-surface-border rounded-2xl overflow-hidden">
          <div className="px-4 md:px-6 py-3 md:py-4 border-b border-surface-border">
            <h3 className="font-display text-base md:text-lg font-semibold text-ink-primary tracking-wide">Pedidos recientes</h3>
          </div>
          {ordersPending || (ordersFetching && orders.length === 0) ? (
            <div className="px-6 py-16 text-center">
              <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto" />
            </div>
          ) : orders.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <svg className="w-12 h-12 text-ink-muted mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm text-ink-muted">Sin pedidos aún</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-border">
              {orders.slice(0, 10).map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between px-4 md:px-6 py-3 md:py-3.5 hover:bg-surface-2/50 transition-colors"
                >
                  <div className="flex items-center gap-3 md:gap-4 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-primary-500/10 border border-primary-500/15 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary-400 font-mono">
                        {order.table?.number ?? "?"}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-ink-primary">
                        Mesa {order.table?.number ?? "?"}
                      </span>
                      <span className="text-xs text-ink-muted ml-2 hidden sm:inline">
                        {order.items.length} {order.items.length !== 1 ? "ítems" : "ítem"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 md:gap-4 shrink-0">
                    <span className="text-sm font-semibold text-ink-primary font-mono tabular-nums">Bs. {order.total}</span>
                    <StatusBadge status={order.status} />
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
    draft:     "bg-surface-2 text-ink-muted border-surface-border",
    placed:    "bg-blue-500/10 text-blue-400 border-blue-500/20",
    preparing: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    ready:     "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    served:    "bg-surface-2 text-ink-muted border-surface-border",
    cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  return (
    <span className={`px-2 md:px-2.5 py-1 text-[10px] md:text-xs font-medium rounded-full capitalize border ${styles[status] ?? "bg-surface-2 text-ink-muted border-surface-border"}`}>
      {ordenEstado[status] ?? status}
    </span>
  );
}
