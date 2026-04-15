import { createFileRoute } from "@tanstack/react-router";
import { trpc } from "../../../trpc.js";

export const Route = createFileRoute("/_app/kitchen/")({
  component: KitchenPage,
});

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-900/30 border-yellow-700 text-yellow-300",
  preparing: "bg-blue-900/30 border-blue-700 text-blue-300",
  ready: "bg-green-900/30 border-green-700 text-green-300",
};

function KitchenPage() {
  const { data: orders = [], isLoading } = trpc.kitchen.activeOrders.list.useQuery(
    undefined,
    { refetchInterval: 30_000 }
  );
  const updateItemStatus = trpc.kitchen.item.updateStatus.useMutation();
  const cancelItem = trpc.kitchen.item.cancel.useMutation();
  const utils = trpc.useUtils();

  async function markItemPreparing(itemId: string) {
    await updateItemStatus.mutateAsync({ id: itemId, status: "preparing" });
    utils.kitchen.activeOrders.list.invalidate();
  }

  async function markItemReady(itemId: string) {
    await updateItemStatus.mutateAsync({ id: itemId, status: "ready" });
    utils.kitchen.activeOrders.list.invalidate();
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="text-muted">Loading orders…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Kitchen Display</h1>
        <span className="text-muted text-sm">{orders.length} active order{orders.length !== 1 ? "s" : ""}</span>
      </div>

      {orders.length === 0 ? (
        <div className="text-center text-muted py-20">No active orders</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {orders.map((order: any) => (
            <div key={order.id} className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className={`px-4 py-3 flex items-center justify-between ${
                order.status === "placed" ? "bg-amber-900/30 border-b border-amber-700" : "bg-blue-900/30 border-b border-blue-700"
              }`}>
                <div>
                  <span className="font-bold">Table {order.tableId ? `#${order.tableId.slice(0, 4)}` : "—"}</span>
                  <span className="text-xs text-muted ml-2">
                    {new Date(order.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded capitalize font-medium ${
                  order.status === "placed" ? "bg-amber-700 text-white" : "bg-blue-700 text-white"
                }`}>{order.status}</span>
              </div>

              <div className="p-3 space-y-2">
                {order.items.map((item: any) => (
                  <div
                    key={item.id}
                    className={`border rounded-lg p-3 ${STATUS_COLORS[item.status] ?? "bg-surface border-border"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-medium">{item.quantity}× {item.itemName}</span>
                        {item.notes && (
                          <p className="text-xs opacity-75 mt-0.5">{item.notes}</p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {item.status === "pending" && (
                          <button
                            onClick={() => markItemPreparing(item.id)}
                            className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-2 py-1 rounded"
                          >
                            Start
                          </button>
                        )}
                        {item.status === "preparing" && (
                          <button
                            onClick={() => markItemReady(item.id)}
                            className="text-xs bg-green-700 hover:bg-green-600 text-white px-2 py-1 rounded"
                          >
                            Ready
                          </button>
                        )}
                        {(item.status === "pending" || item.status === "preparing") && (
                          <button
                            onClick={() => cancelItem.mutate({ id: item.id })}
                            className="text-xs bg-destructive/30 hover:bg-destructive/50 text-destructive px-2 py-1 rounded"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
