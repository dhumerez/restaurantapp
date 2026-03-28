import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { fetchTables, getOrders } from "../../api/orders";
import { Header } from "../../components/layout/Header";
import { useSocket } from "../../context/SocketContext";
import { ordenEstado } from "../../utils/labels";
import type { Table, Order } from "../../types";

const orderStatusConfig: Record<string, { border: string; bg: string; badge: string; dot: string }> = {
  draft:     { border: "border-surface-border",      bg: "",                         badge: "bg-surface-2 text-ink-muted border-surface-border",          dot: "bg-ink-muted" },
  placed:    { border: "border-blue-500/40",          bg: "bg-blue-500/5",            badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",            dot: "bg-blue-400" },
  preparing: { border: "border-amber-500/50",         bg: "bg-amber-500/5",           badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",         dot: "bg-amber-400 animate-pulse" },
  ready:     { border: "border-emerald-500/50",       bg: "bg-emerald-500/5",         badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",   dot: "bg-emerald-400" },
  served:    { border: "border-surface-border",      bg: "",                         badge: "bg-surface-2 text-ink-muted border-surface-border",          dot: "bg-ink-muted" },
  cancelled: { border: "border-surface-border",      bg: "",                         badge: "bg-surface-2 text-ink-muted border-surface-border",          dot: "bg-ink-muted" },
};

export function TablesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const socket = useSocket();

  const { data: tables = [] } = useQuery({
    queryKey: ["tables"],
    queryFn: fetchTables,
  });

  const { data: activeOrders = [] } = useQuery({
    queryKey: ["orders", "active"],
    queryFn: () => getOrders("draft,placed,preparing,ready"),
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["orders", "active"] });
    };

    socket.on("order:new", handleUpdate);
    socket.on("order:item-updated", handleUpdate);
    socket.on("order:ready", handleUpdate);
    socket.on("order:cancelled", handleUpdate);

    return () => {
      socket.off("order:new", handleUpdate);
      socket.off("order:item-updated", handleUpdate);
      socket.off("order:ready", handleUpdate);
      socket.off("order:cancelled", handleUpdate);
    };
  }, [socket, queryClient]);

  const orderByTable = new Map<string, Order>();
  for (const order of activeOrders) {
    if (!orderByTable.has(order.tableId) || order.status === "draft") {
      orderByTable.set(order.tableId, order);
    }
  }

  const handleTableClick = (table: Table) => {
    const existingOrder = orderByTable.get(table.id);
    if (existingOrder) {
      navigate(`/order/${existingOrder.id}`);
    } else {
      navigate(`/order/new?table=${table.id}`);
    }
  };

  return (
    <div className="flex-1 bg-surface-0">
      <Header title="Mesas" />
      <div className="p-3 md:p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3">
          {tables.map((table) => {
            const order = orderByTable.get(table.id);
            const isBusy = !!order;
            const cfg = order ? (orderStatusConfig[order.status] ?? orderStatusConfig.draft) : null;

            return (
              <button
                key={table.id}
                onClick={() => handleTableClick(table)}
                className={`relative p-3 md:p-5 rounded-xl md:rounded-2xl border-2 transition-all text-center group
                  hover:scale-[1.02] active:scale-[0.98]
                  ${cfg ? `${cfg.border} ${cfg.bg}` : "border-surface-border bg-surface-1 hover:border-primary-500/30"}`}
              >
                {/* Table number */}
                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl mx-auto mb-2 md:mb-3 flex items-center justify-center
                  ${cfg ? "bg-surface-2/60" : "bg-primary-500/10 border border-primary-500/15"}`}>
                  <span className={`text-xl md:text-2xl font-bold font-mono tabular-nums ${cfg ? "text-ink-primary" : "text-primary-400"}`}>
                    {table.number}
                  </span>
                </div>

                <div className="text-xs text-ink-muted mb-1">
                  {table.label || `Mesa ${table.number}`}
                </div>
                <div className="text-xs text-ink-muted mb-3">{table.seats} asientos</div>

                {isBusy && order && cfg ? (
                  <>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${cfg.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {ordenEstado[order.status] ?? order.status}
                    </span>
                    {order.total !== "0.00" && (
                      <div className="text-sm font-semibold text-ink-primary mt-2 font-mono tabular-nums">
                        Bs. {order.total}
                      </div>
                    )}
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full
                    bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Disponible
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
