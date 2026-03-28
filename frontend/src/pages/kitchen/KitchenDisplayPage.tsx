import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { getKitchenOrders, updateItemStatus, updateOrderStatus } from "../../api/orders";
import { useSocket } from "../../context/SocketContext";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/ui/Toast";
import { itemEstado } from "../../utils/labels";
import type { Order, OrderItem } from "../../types";

type ItemStatus = "preparing" | "ready" | "served";

const ticketBorderColor: Record<string, string> = {
  placed:    "border-blue-500/50",
  preparing: "border-amber-500/60",
  ready:     "border-emerald-500/60",
};

const ticketHeaderColor: Record<string, string> = {
  placed:    "bg-blue-500/10",
  preparing: "bg-amber-500/10",
  ready:     "bg-emerald-500/10",
};

export function KitchenDisplayPage() {
  const queryClient = useQueryClient();
  const socket = useSocket();
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data: orders = [] } = useQuery({
    queryKey: ["kitchen-orders"],
    queryFn: getKitchenOrders,
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (!socket) return;

    const handleNewOrder = () => {
      queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] });
      toast("¡Nuevo pedido recibido!", "info");
      try {
        audioRef.current?.play();
      } catch {
        // Audio may be blocked by browser
      }
    };

    const handleOrderUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] });
    };

    socket.on("order:new", handleNewOrder);
    socket.on("order:item-updated", handleOrderUpdated);
    socket.on("order:cancelled", handleOrderUpdated);

    return () => {
      socket.off("order:new", handleNewOrder);
      socket.off("order:item-updated", handleOrderUpdated);
      socket.off("order:cancelled", handleOrderUpdated);
    };
  }, [socket, queryClient, toast]);

  const updateItemMut = useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: ItemStatus }) =>
      updateItemStatus(itemId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] });
    },
  });

  const updateOrderMut = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: "preparing" | "ready" | "served" }) =>
      updateOrderStatus(orderId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] });
    },
  });

  const getTimeSince = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Ahora";
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const getTimeUrgency = (dateStr: string): "normal" | "warning" | "critical" => {
    const mins = (Date.now() - new Date(dateStr).getTime()) / 60000;
    if (mins > 15) return "critical";
    if (mins > 10) return "warning";
    return "normal";
  };

  const timeColors = {
    normal:   "text-ink-muted bg-surface-3",
    warning:  "text-amber-400 bg-amber-500/10",
    critical: "text-red-400 bg-red-500/10",
  };

  return (
    <div className="min-h-screen bg-surface-0 text-ink-primary">
      <audio ref={audioRef} preload="auto">
        <source src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbsGczHjl0teleNhUYTpG90bFpLRsmZ6HR2K9gIhIcUJfG2LBcHRAeW6HL2qlWHBQkYaTO166OeTMv" type="audio/wav" />
      </audio>

      {/* Header */}
      <div className="bg-surface-1 border-b border-surface-border px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex items-center gap-2 md:gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary-500 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-surface-0" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-.293.707L13 10.414V15a1 1 0 01-.553.894l-4 2A1 1 0 017 17v-6.586L3.293 6.707A1 1 0 013 6V4z"/>
              </svg>
            </div>
            <span className="text-base md:text-lg font-semibold text-ink-primary tracking-wide hidden sm:block">Pantalla de Cocina</span>
            <span className="text-base font-semibold text-ink-primary tracking-wide sm:hidden">Cocina</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 md:px-3 py-1 rounded-full bg-surface-2 border border-surface-border">
            <span className={`w-2 h-2 rounded-full ${orders.length > 0 ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
            <span className="text-[10px] md:text-xs text-ink-secondary">
              {orders.length} pedido{orders.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-xs font-semibold text-orange-400">
              {user?.name?.charAt(0)?.toUpperCase() ?? "?"}
            </div>
            <span className="text-sm text-ink-secondary hidden sm:block">{user?.name}</span>
          </div>
          <button
            onClick={async () => {
              await logout();
              window.location.href = import.meta.env.BASE_URL + "login";
            }}
            className="px-2 md:px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-red-400 hover:bg-red-500/8 rounded-lg transition-all min-h-[2.25rem]"
          >
            Salir
          </button>
        </div>
      </div>

      {/* Orders grid */}
      <div className="p-3 md:p-5">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[70vh] text-center">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-surface-1 border border-surface-border flex items-center justify-center mb-4 md:mb-5">
              <svg className="w-8 h-8 md:w-10 md:h-10 text-ink-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-lg md:text-xl font-semibold text-ink-secondary">Sin pedidos activos</p>
            <p className="text-xs md:text-sm text-ink-muted mt-2">Los nuevos pedidos aparecerán aquí automáticamente</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
            {orders.map((order) => (
              <OrderTicket
                key={order.id}
                order={order}
                getTimeSince={getTimeSince}
                getTimeUrgency={getTimeUrgency}
                timeColors={timeColors}
                onUpdateItem={(itemId, status) => updateItemMut.mutate({ itemId, status })}
                onMarkServed={() => updateOrderMut.mutate({ orderId: order.id, status: "served" })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OrderTicket({
  order,
  getTimeSince,
  getTimeUrgency,
  timeColors,
  onUpdateItem,
  onMarkServed,
}: {
  order: Order;
  getTimeSince: (d: string) => string;
  getTimeUrgency: (d: string) => "normal" | "warning" | "critical";
  timeColors: Record<string, string>;
  onUpdateItem: (itemId: string, status: ItemStatus) => void;
  onMarkServed: () => void;
}) {
  const urgency = getTimeUrgency(order.createdAt);
  const border = ticketBorderColor[order.status] ?? ticketBorderColor.placed;
  const headerBg = ticketHeaderColor[order.status] ?? ticketHeaderColor.placed;

  const allReady = order.items.length > 0 && order.items.every(
    (i) => i.status === "ready" || i.status === "served"
  );

  return (
    <div className={`bg-surface-1 rounded-2xl border-2 ${border} overflow-hidden flex flex-col`}>
      {/* Ticket header */}
      <div className={`px-3 md:px-4 py-2.5 md:py-3 ${headerBg} flex items-center justify-between`}>
        <div>
          <span className="text-lg md:text-xl font-bold text-ink-primary font-mono tabular-nums">
            Mesa {order.table?.number ?? "?"}
          </span>
          {order.waiter?.name && (
            <span className="text-xs text-ink-muted ml-2 hidden sm:inline">{order.waiter.name}</span>
          )}
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-lg ${timeColors[urgency]}`}>
          {getTimeSince(order.createdAt)}
        </span>
      </div>

      {/* Items */}
      <div className="p-2 md:p-3 space-y-1 md:space-y-1.5 flex-1">
        {order.items.map((item) => (
          <KitchenItem key={item.id} item={item} onUpdateStatus={onUpdateItem} />
        ))}
      </div>

      {/* Notes */}
      {order.notes && (
        <div className="px-2 md:px-3 pb-2">
          <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/8 border border-amber-500/15 px-3 py-2 rounded-lg">
            <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {order.notes}
          </div>
        </div>
      )}

      {/* Mark served */}
      {allReady && (
        <div className="p-2 md:p-3 border-t border-surface-border">
          <button
            onClick={onMarkServed}
            className="w-full py-3 md:py-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30
              text-emerald-400 rounded-xl text-sm font-medium transition-all active:scale-[0.98]"
          >
            Marcar pedido como servido
          </button>
        </div>
      )}
    </div>
  );
}

function KitchenItem({
  item,
  onUpdateStatus,
}: {
  item: OrderItem;
  onUpdateStatus: (itemId: string, status: ItemStatus) => void;
}) {
  const statusStyles: Record<string, string> = {
    pending:   "bg-blue-500/10 text-blue-400 border-blue-500/20",
    preparing: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    ready:     "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    served:    "bg-surface-2 text-ink-muted border-surface-border",
    cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  const nextStatus: Record<string, ItemStatus | null> = {
    pending: "preparing",
    preparing: "ready",
    ready: "served",
    served: null,
    cancelled: null,
  };

  const buttonStyles: Record<string, string> = {
    preparing: "bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/30 text-amber-400",
    ready:     "bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/30 text-emerald-400",
    served:    "bg-surface-2 hover:bg-surface-3 border-surface-border text-ink-muted",
  };

  const buttonLabels: Record<string, string> = {
    preparing: "Iniciar",
    ready:     "Listo",
    served:    "Servido",
  };

  const next = nextStatus[item.status];
  const isCancelled = item.status === "cancelled";

  return (
    <div className={`flex items-center gap-2 p-2 rounded-lg ${isCancelled ? "opacity-40" : "hover:bg-surface-2/40"} transition-colors`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
          <span className={`text-sm font-medium ${isCancelled ? "line-through text-ink-muted" : "text-ink-primary"}`}>
            <span className="text-primary-400 font-semibold">{item.quantity}×</span> {item.itemName}
          </span>
          <span className={`text-[10px] md:text-xs px-1.5 py-0.5 rounded-full border capitalize ${statusStyles[item.status] ?? statusStyles.pending}`}>
            {itemEstado[item.status] ?? item.status}
          </span>
        </div>
        {item.notes && (
          <div className="text-xs text-ink-muted mt-0.5 pl-0.5">{item.notes}</div>
        )}
      </div>
      {next && !isCancelled && (
        <button
          onClick={() => onUpdateStatus(item.id, next)}
          className={`px-3 py-1.5 md:px-2.5 md:py-1 rounded-lg text-xs font-medium border transition-all shrink-0 min-h-[2rem] ${buttonStyles[next]}`}
        >
          {buttonLabels[next]}
        </button>
      )}
    </div>
  );
}
