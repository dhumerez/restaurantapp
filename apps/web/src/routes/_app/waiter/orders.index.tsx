import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { trpc } from "../../../trpc.js";
import { ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_app/waiter/orders/")({
  component: WaiterOrdersIndex,
});

const STATUS_LABEL: Record<string, string> = {
  placed: "Enviado",
  preparing: "En cocina",
  ready: "Lista",
  served: "Servida",
};

const STATUS_STYLE: Record<string, string> = {
  placed: "bg-blue-900/50 text-blue-200",
  preparing: "bg-amber-900/50 text-amber-200",
  ready: "bg-green-900/50 text-green-200",
  served: "bg-neutral-800 text-neutral-300",
};

type Filter = "all" | "placed" | "preparing" | "ready" | "served";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "placed", label: "Enviados" },
  { key: "preparing", label: "En cocina" },
  { key: "ready", label: "Listos" },
  { key: "served", label: "Servidos" },
];

const VISIBLE_STATUSES = new Set(["placed", "preparing", "ready", "served"]);

function WaiterOrdersIndex() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const { data: orders = [], isLoading } = trpc.orders.list.useQuery();
  const { data: tables = [] } = trpc.tables.list.useQuery();

  const tableById = new Map<string, any>(tables.map((t: any) => [t.id, t]));

  const visible = (orders as any[])
    .filter((o) => VISIBLE_STATUSES.has(o.status))
    .filter((o) => (filter === "all" ? true : o.status === filter))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (isLoading) return <div className="text-muted">Cargando pedidos…</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Pedidos</h1>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
              filter === f.key
                ? "bg-accent text-black font-medium"
                : "bg-surface border border-border text-muted hover:text-white"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="text-muted text-center py-12 border border-border rounded-xl">
          No hay pedidos en este estado.
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((o) => {
            const table = tableById.get(o.tableId);
            return (
              <li key={o.id}>
                <button
                  onClick={() =>
                    navigate({ to: "/waiter/orders/$id", params: { id: o.id } })
                  }
                  className="w-full flex items-center justify-between gap-4 bg-surface border border-border rounded-xl p-4 hover:border-accent/60 transition-colors"
                >
                  <div className="flex-1 text-left">
                    <div className="font-semibold">
                      Mesa {table?.number ?? "—"}
                      {table?.label ? (
                        <span className="text-muted font-normal"> · {table.label}</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      Total ${Number(o.total ?? 0).toFixed(2)}
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      STATUS_STYLE[o.status] ?? "bg-neutral-800 text-neutral-300"
                    }`}
                  >
                    {STATUS_LABEL[o.status] ?? o.status}
                  </span>
                  <ChevronRight size={18} className="text-muted" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
