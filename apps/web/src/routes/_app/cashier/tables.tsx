import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { trpc } from "../../../trpc.js";

export const Route = createFileRoute("/_app/cashier/tables")({
  component: CashierTablesPage,
});

function CashierTablesPage() {
  const navigate = useNavigate();
  const { data: tables = [] } = trpc.tables.list.useQuery();
  const { data: orders = [] } = trpc.orders.list.useQuery();

  const tableOrderMap = new Map(
    orders
      .filter((o: any) => ["placed", "preparing", "ready"].includes(o.status))
      .map((o: any) => [o.tableId, o])
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Mesas</h1>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {tables.map((table: any) => {
          const order = tableOrderMap.get(table.id);
          const isReady = order?.status === "ready";
          return (
            <button
              key={table.id}
              onClick={() => order && navigate({ to: "/cashier/orders/$id", params: { id: order.id } })}
              className={`rounded-xl p-4 text-left border transition-all ${
                isReady
                  ? "bg-green-900/30 border-green-600 hover:border-green-400 cursor-pointer"
                  : order
                  ? "bg-amber-900/30 border-amber-600 hover:border-amber-400 cursor-pointer"
                  : "bg-surface border-border cursor-default"
              }`}
            >
              <div className="font-bold text-lg">{table.number}</div>
              <div className="text-xs mt-1 capitalize text-muted">
                {isReady ? "Lista para servir" : order ? order.status : "Libre"}
              </div>
              {order && (
                <div className="text-xs text-accent mt-1">${order.total}</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
