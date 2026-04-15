import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as ordersApi from "../../api/orders";
import type { OrderEvent } from "../../types";

const ACTION_CONFIG: Record<
  OrderEvent["action"],
  { label: string; icon: string; color: string }
> = {
  created: { label: "Orden creada", icon: "📝", color: "text-blue-400" },
  items_updated: { label: "Items actualizados", icon: "🔄", color: "text-amber-400" },
  placed: { label: "Orden enviada", icon: "📤", color: "text-primary-400" },
  status_changed: { label: "Estado cambiado", icon: "🔀", color: "text-purple-400" },
  item_status_changed: { label: "Item actualizado", icon: "🍳", color: "text-orange-400" },
  transferred: { label: "Mesa transferida", icon: "↗️", color: "text-cyan-400" },
  merged: { label: "Orden fusionada", icon: "🔗", color: "text-indigo-400" },
  discount_applied: { label: "Descuento aplicado", icon: "🏷️", color: "text-emerald-400" },
  served: { label: "Orden servida", icon: "✅", color: "text-green-400" },
  cancelled: { label: "Orden cancelada", icon: "❌", color: "text-red-400" },
};

function getDetail(event: OrderEvent): string | null {
  const d = event.details;
  if (!d) return null;

  switch (event.action) {
    case "status_changed":
      return `→ ${d.status}`;
    case "item_status_changed":
      return `${d.itemName} → ${d.status}`;
    case "discount_applied": {
      if (d.discountType === "none") return "Descuento eliminado";
      const val = d.discountType === "percentage" ? `${d.discountValue}%` : `Bs. ${d.discountValue}`;
      return `${val}${d.discountReason ? ` — ${d.discountReason}` : ""}`;
    }
    case "items_updated":
      return `${d.itemCount} items`;
    default:
      return null;
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  if (diff < 60_000) return "ahora";
  if (diff < 3600_000) return `hace ${Math.floor(diff / 60_000)}m`;
  if (diff < 86400_000) return `hace ${Math.floor(diff / 3600_000)}h`;

  return d.toLocaleDateString("es", { day: "numeric", month: "short" }) +
    " " + d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  waiter: "Mesero",
  kitchen: "Cocina",
  cashier: "Cajero",
};

interface Props {
  orderId: string;
}

export function ActivityLog({ orderId }: Props) {
  const [open, setOpen] = useState(false);

  const { data: events = [], isPending: eventsPending, isFetching: eventsFetching } = useQuery({
    queryKey: ["orderEvents", orderId],
    queryFn: () => ordersApi.getOrderEvents(orderId),
    enabled: open,
    staleTime: 15_000,
    refetchInterval: open ? 15_000 : false,
  });

  return (
    <div className="border-t border-surface-border pt-3 mt-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-left group"
      >
        <span className="text-xs font-medium text-ink-secondary group-hover:text-ink-primary transition-colors">
          Historial de actividad
        </span>
        <svg
          className={`w-3.5 h-3.5 text-ink-muted transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-3 space-y-0">
          {eventsPending || (eventsFetching && events.length === 0) ? (
            <p className="text-xs text-ink-muted text-center py-4">Cargando...</p>
          ) : events.length === 0 ? (
            <p className="text-xs text-ink-muted text-center py-4">Sin actividad registrada</p>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-surface-border" />

              {events.map((event, i) => {
                const config = ACTION_CONFIG[event.action];
                const detail = getDetail(event);

                return (
                  <div key={event.id} className="relative flex gap-3 pb-3 last:pb-0">
                    {/* Dot */}
                    <div className="relative z-10 flex-shrink-0 w-[15px] h-[15px] rounded-full bg-surface-2 border border-surface-border flex items-center justify-center mt-0.5">
                      <div className={`w-[7px] h-[7px] rounded-full ${
                        i === 0 ? "bg-primary-500" : "bg-ink-muted/40"
                      }`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={`text-xs font-medium ${config.color}`}>
                          {config.label}
                        </span>
                        <span className="text-[10px] text-ink-muted whitespace-nowrap">
                          {formatTime(event.createdAt)}
                        </span>
                      </div>
                      <div className="text-[11px] text-ink-muted leading-tight mt-0.5">
                        {event.userName}
                        <span className="text-ink-muted/50"> · {ROLE_LABELS[event.userRole] ?? event.userRole}</span>
                      </div>
                      {detail && (
                        <p className="text-[11px] text-ink-secondary mt-0.5">{detail}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
