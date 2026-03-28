import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getOrders } from "../../api/orders";
import { Header } from "../../components/layout/Header";
import { useSocket } from "../../context/SocketContext";
import { ordenEstado } from "../../utils/labels";
import type { Order } from "../../types";

const STATUS_FILTERS = [
  { label: "Activos", value: "draft,placed,preparing,ready" },
  { label: "Servidos", value: "served" },
  { label: "Cancelados", value: "cancelled" },
  { label: "Todos", value: "" },
] as const;

const statusStyles: Record<string, string> = {
  draft:     "bg-surface-2 text-ink-muted border-surface-border",
  placed:    "bg-blue-500/10 text-blue-400 border-blue-500/20",
  preparing: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  ready:     "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  served:    "bg-surface-2 text-ink-muted border-surface-border",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
};

export function OrdersListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const socket = useSocket();
  const [statusFilter, setStatusFilter] = useState<string>(STATUS_FILTERS[0].value);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders", "list", statusFilter],
    queryFn: () => getOrders(statusFilter || undefined),
  });

  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["orders", "list"] });
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

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return "Hoy";
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "Ayer";
    return date.toLocaleDateString();
  };

  const grouped = orders.reduce<Record<string, Order[]>>((acc, order) => {
    const key = formatDate(order.createdAt);
    if (!acc[key]) acc[key] = [];
    acc[key].push(order);
    return acc;
  }, {});

  return (
    <div className="flex-1 bg-surface-0">
      <Header title="Pedidos" />
      <div className="p-4 md:p-6 max-w-3xl">
        {/* Filter tabs */}
        <div className="flex gap-1 md:gap-1.5 mb-4 md:mb-6 bg-surface-1 border border-surface-border rounded-xl p-1 overflow-x-auto scrollbar-hide">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              className={`flex-1 px-3 py-2 md:py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all whitespace-nowrap min-h-[2.25rem] ${
                statusFilter === f.value
                  ? "bg-primary-500 text-ink-inverse shadow-sm"
                  : "text-ink-secondary hover:text-ink-primary"
              }`}
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-surface-1 border border-surface-border rounded-2xl p-16 text-center">
            <svg className="w-12 h-12 text-ink-muted mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm text-ink-muted">Sin pedidos</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([date, dateOrders]) => (
              <div key={date}>
                <h3 className="text-xs font-medium text-ink-muted uppercase tracking-widest mb-2 px-1">
                  {date}
                </h3>
                <div className="space-y-1.5">
                  {dateOrders.map((order) => (
                    <button
                      key={order.id}
                      onClick={() => navigate(`/order/${order.id}`)}
                      className="w-full bg-surface-1 border border-surface-border rounded-xl p-3 md:p-4 flex items-center gap-3 md:gap-4
                        hover:border-surface-border-light hover:bg-surface-2/30 transition-all text-left group"
                    >
                      {/* Table badge */}
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary-500/10 border border-primary-500/15 flex flex-col items-center justify-center shrink-0">
                        <span className="text-[10px] text-primary-400/70 leading-tight">Mesa</span>
                        <span className="text-base md:text-lg font-bold text-primary-400 leading-tight font-mono tabular-nums">
                          {order.table?.number ?? "?"}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 md:gap-2 mb-1 flex-wrap">
                          <span className="text-xs md:text-sm font-medium text-ink-primary">
                            #{order.id.slice(0, 8)}
                          </span>
                          <span className={`px-2 py-0.5 text-[10px] md:text-xs font-medium rounded-full capitalize border ${statusStyles[order.status] ?? statusStyles.draft}`}>
                            {ordenEstado[order.status] ?? order.status}
                          </span>
                        </div>
                        <p className="text-xs text-ink-muted">
                          {order.items.length} ítem{order.items.length !== 1 ? "s" : ""}
                          {order.waiter && <span className="ml-1.5 hidden sm:inline">· {order.waiter.name}</span>}
                        </p>
                      </div>

                      {/* Total + time */}
                      <div className="text-right shrink-0">
                        <div className="text-sm font-semibold text-ink-primary font-mono tabular-nums">Bs. {order.total}</div>
                        <div className="text-xs text-ink-muted mt-0.5">{formatTime(order.createdAt)}</div>
                      </div>

                      <svg className="w-4 h-4 text-ink-muted group-hover:text-ink-secondary transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
