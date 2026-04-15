import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { trpc } from "../../../trpc.js";
import { ChevronRight, Plus } from "lucide-react";

export const Route = createFileRoute("/_app/waiter/orders/")({
  component: WaiterOrdersIndex,
});

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  placed: "Enviado",
  preparing: "En cocina",
  ready: "Lista",
  served: "Servida",
  cancelled: "Cancelada",
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-neutral-800 text-neutral-300",
  placed: "bg-blue-900/50 text-blue-200",
  preparing: "bg-amber-900/50 text-amber-200",
  ready: "bg-green-900/50 text-green-200",
};

const ACTIVE_STATUSES = new Set(["draft", "placed", "preparing", "ready"]);

function WaiterOrdersIndex() {
  const navigate = useNavigate();
  const { data: orders = [], isLoading } = trpc.orders.list.useQuery();
  const { data: tables = [] } = trpc.tables.list.useQuery();

  const tableById = new Map<string, any>(tables.map((t: any) => [t.id, t]));

  const active = (orders as any[])
    .filter((o) => ACTIVE_STATUSES.has(o.status))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (isLoading) return <div className="text-muted">Cargando pedidos…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pedidos activos</h1>
        <button
          onClick={() => navigate({ to: "/waiter/tables" })}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-black text-sm font-semibold"
        >
          <Plus size={16} /> Nuevo pedido
        </button>
      </div>

      {active.length === 0 ? (
        <div className="text-muted text-center py-12 border border-border rounded-xl">
          No tienes pedidos activos. Toca una mesa para crear uno.
        </div>
      ) : (
        <ul className="space-y-2">
          {active.map((o) => {
            const table = tableById.get(o.tableId);
            return (
              <li key={o.id}>
                <button
                  onClick={() =>
                    navigate({ to: "/waiter/orders/$id", params: { id: o.id } })
                  }
                  className="w-full flex items-center justify-between gap-4 bg-surface border border-border rounded-xl p-4 hover:border-primary/60 transition-colors"
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
