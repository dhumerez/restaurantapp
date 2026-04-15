import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { trpc } from "../../../trpc.js";

export const Route = createFileRoute("/_app/waiter/tables")({
  component: TablesPage,
});

const STATUS_COLOR: Record<string, string> = {
  free: "bg-surface border-border",
  occupied: "bg-amber-900/30 border-amber-600",
  ready: "bg-green-900/30 border-green-600",
};

function TablesPage() {
  const navigate = useNavigate();
  const { data: tables = [], isLoading } = trpc.tables.list.useQuery();
  const { data: orders = [] } = trpc.orders.list.useQuery({ status: "placed" });

  const tableOrderStatus = new Map(
    orders.map((o: any) => [o.tableId, o.status])
  );

  if (isLoading) return <div className="text-muted">Loading tables…</div>;

  async function handleTableClick(tableId: string) {
    const activeOrder = orders.find((o: any) => o.tableId === tableId);
    if (activeOrder) {
      navigate({ to: "/waiter/orders/$id", params: { id: activeOrder.id } });
    } else {
      navigate({ to: "/waiter/orders/new", search: { tableId } });
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tables</h1>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {tables.map((table: any) => {
          const orderStatus = tableOrderStatus.get(table.id);
          const statusKey = orderStatus === "ready" ? "ready" : orderStatus ? "occupied" : "free";
          return (
            <button
              key={table.id}
              onClick={() => handleTableClick(table.id)}
              className={`${STATUS_COLOR[statusKey]} border rounded-xl p-4 text-left transition-all hover:scale-105`}
            >
              <div className="font-bold text-lg">{table.number}</div>
              {table.label && <div className="text-xs text-muted">{table.label}</div>}
              <div className="text-xs mt-1 capitalize">{statusKey}</div>
            </button>
          );
        })}
      </div>
      <div className="flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-surface border border-border inline-block" /> Free</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-900/30 border border-amber-600 inline-block" /> Occupied</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-900/30 border border-green-600 inline-block" /> Ready</span>
      </div>
    </div>
  );
}
