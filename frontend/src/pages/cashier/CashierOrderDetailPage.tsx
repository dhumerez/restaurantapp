import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as ordersApi from "../../api/orders";
import { Header } from "../../components/layout/Header";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useToast } from "../../components/ui/Toast";
import { useSocket } from "../../context/SocketContext";
import { ordenEstado, itemEstado } from "../../utils/labels";
import { printReceipt } from "../../utils/printReceipt";
import { DiscountSection } from "../../components/order/DiscountSection";
import { ActivityLog } from "../../components/order/ActivityLog";
import { TablePickerModal } from "../../components/order/TablePickerModal";

const itemStatusStyles: Record<string, string> = {
  pending:   "bg-blue-500/10 text-blue-400 border-blue-500/20",
  preparing: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  ready:     "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  served:    "bg-surface-2 text-ink-muted border-surface-border",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
};

const orderStatusStyles: Record<string, string> = {
  draft:     "bg-surface-2 text-ink-muted border-surface-border",
  placed:    "bg-blue-500/10 text-blue-400 border-blue-500/20",
  preparing: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  ready:     "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  served:    "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
};

export function CashierOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const socket = useSocket();
  const [cancelTarget, setCancelTarget] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showMergeConfirm, setShowMergeConfirm] = useState<{ sourceId: string; targetId: string; targetTable: number } | null>(null);

  const { data: order, isPending: orderPending, isFetching: orderFetching } = useQuery({
    queryKey: ["order", id],
    queryFn: () => ordersApi.getOrder(id!),
    enabled: !!id,
    staleTime: 30000,
  });

  useEffect(() => {
    if (!socket || !id) return;

    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
    };

    const handleReady = () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      toast("Pedido listo para servir", "success");
    };

    socket.on("order:item-updated", handleUpdate);
    socket.on("order:ready", handleReady);
    socket.on("order:cancelled", handleUpdate);

    return () => {
      socket.off("order:item-updated", handleUpdate);
      socket.off("order:ready", handleReady);
      socket.off("order:cancelled", handleUpdate);
    };
  }, [socket, id, queryClient, toast]);

  const serveMut = useMutation({
    mutationFn: () => ordersApi.serveOrder(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast("Pedido marcado como servido", "success");
    },
    onError: () => toast("Error al marcar como servido", "error"),
  });

  const cancelMut = useMutation({
    mutationFn: () => ordersApi.cancelOrder(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast("Pedido cancelado", "success");
    },
    onError: () => toast("Error al cancelar pedido", "error"),
  });

  const transferMut = useMutation({
    mutationFn: ({ tableId }: { tableId: string }) => ordersApi.transferOrder(id!, tableId),
    onSuccess: (updatedOrder) => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast(`Pedido transferido a mesa ${updatedOrder.table?.number}`, "success");
      setShowTransfer(false);
    },
    onError: (err: any) => toast(err?.response?.data?.error ?? "Error al transferir", "error"),
  });

  const mergeMut = useMutation({
    mutationFn: ({ sourceId, targetId }: { sourceId: string; targetId: string }) =>
      ordersApi.mergeOrders(sourceId, targetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast("Pedidos fusionados", "success");
      setShowMergeConfirm(null);
      navigate("/tables");
    },
    onError: (err: any) => toast(err?.response?.data?.error ?? "Error al fusionar", "error"),
  });

  // Find other active orders on the same table for merge
  const { data: tableOrders = [] } = useQuery({
    queryKey: ["orders", { table: order?.tableId, active: true }],
    queryFn: () => ordersApi.getOrders("placed,preparing,ready", order!.tableId),
    enabled: !!order && ["placed", "preparing", "ready"].includes(order.status),
    staleTime: 30000,
  });

  const mergeableOrders = tableOrders.filter(
    (o) => o.id !== id && ["placed", "preparing", "ready"].includes(o.status)
  );

  if (orderPending || (orderFetching && !order)) {
    return (
      <div className="flex-1 bg-surface-0">
        <Header title="Detalle del pedido" />
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex-1 bg-surface-0">
        <Header title="Pedido no encontrado" />
        <div className="p-6 text-center">
          <p className="text-sm text-ink-muted mb-4">Este pedido no existe o no tienes acceso.</p>
          <Button onClick={() => navigate("/tables")}>Volver a mesas</Button>
        </div>
      </div>
    );
  }

  const canServe = order.status === "ready";
  const canCancel = order.status === "draft" || order.status === "placed";
  const canPrint = order.status === "served" || order.status === "ready";

  return (
    <div className="flex-1 bg-surface-0">
      <Header title={`Pedido #${order.id.slice(0, 8)}`} />
      <div className="p-4 md:p-6 max-w-2xl">
        {/* Order info card */}
        <div className="bg-surface-1 border border-surface-border rounded-2xl p-4 md:p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary-500/10 border border-primary-500/15 flex flex-col items-center justify-center">
                <span className="text-[10px] text-primary-400/70 leading-tight">Mesa</span>
                <span className="text-lg font-bold text-primary-400 leading-tight font-mono tabular-nums">
                  {order.table?.number ?? "?"}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-ink-primary">
                  Pedido #{order.id.slice(0, 8)}
                </p>
                <p className="text-xs text-ink-muted">
                  {new Date(order.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
            <span className={`px-2.5 py-1 text-xs font-medium rounded-full capitalize border ${
              orderStatusStyles[order.status] ?? orderStatusStyles.draft
            }`}>
              {ordenEstado[order.status] ?? order.status}
            </span>
          </div>

          {order.waiter && (
            <div className="flex items-center gap-2 px-3 py-2 bg-surface-2/50 rounded-lg">
              <div className="w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-[10px] font-semibold text-blue-400">
                {order.waiter.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs text-ink-secondary">
                Mesero: <span className="font-medium text-ink-primary">{order.waiter.name}</span>
              </span>
            </div>
          )}
        </div>

        {/* Items list */}
        <div className="bg-surface-1 border border-surface-border rounded-2xl overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-surface-border">
            <h3 className="text-xs font-medium text-ink-muted uppercase tracking-widest">
              Items ({order.items.length})
            </h3>
          </div>
          <div className="divide-y divide-surface-border">
            {order.items.map((item) => (
              <div
                key={item.id}
                className={`p-4 ${item.status === "cancelled" ? "opacity-50" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium leading-snug ${
                      item.status === "cancelled" ? "line-through text-ink-muted" : "text-ink-primary"
                    }`}>
                      <span className="text-primary-400">{item.quantity}×</span> {item.itemName}
                    </p>
                    {item.notes && (
                      <p className="text-xs text-ink-muted mt-0.5">{item.notes}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-ink-primary">
                      Bs. {(parseFloat(item.unitPrice) * item.quantity).toFixed(2)}
                    </p>
                    <p className="text-xs text-ink-muted">Bs. {parseFloat(item.unitPrice).toFixed(2)} c/u</p>
                  </div>
                </div>
                <div className="mt-2">
                  <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full border capitalize ${
                    itemStatusStyles[item.status] ?? itemStatusStyles.pending
                  }`}>
                    {itemEstado[item.status] ?? item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Order notes */}
        {order.notes && (
          <div className="flex items-start gap-2 p-4 bg-amber-500/8 border border-amber-500/15 rounded-xl mb-4">
            <svg className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
            <p className="text-xs text-amber-400">{order.notes}</p>
          </div>
        )}

        {/* Totals */}
        <div className="bg-surface-1 border border-surface-border rounded-2xl p-4 mb-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm text-ink-muted">
              <span>Subtotal</span>
              <span>Bs. {parseFloat(order.subtotal).toFixed(2)}</span>
            </div>
            <DiscountSection
              order={order}
              onApplied={() => {
                queryClient.invalidateQueries({ queryKey: ["order", id] });
                queryClient.invalidateQueries({ queryKey: ["orders"] });
              }}
            />
            <div className="flex justify-between text-sm text-ink-muted">
              <span>Impuesto</span>
              <span>Bs. {parseFloat(order.tax).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-surface-border">
              <span className="text-xs text-ink-muted uppercase tracking-widest">Total</span>
              <span className="text-xl font-bold text-ink-primary font-mono tabular-nums">
                Bs. {parseFloat(order.total).toFixed(2)}
              </span>
            </div>
            <ActivityLog orderId={order.id} />
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {canServe && (
            <Button className="w-full" onClick={() => serveMut.mutate()} disabled={serveMut.isPending}>
              Marcar como servido
            </Button>
          )}

          {canPrint && (
            <Button variant="outline" className="w-full" onClick={() => printReceipt(order)}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Imprimir recibo
            </Button>
          )}

          {/* Transfer & merge — available for active orders */}
          {["placed", "preparing", "ready"].includes(order.status) && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setShowTransfer(true)}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Transferir
              </Button>
              {mergeableOrders.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    const target = mergeableOrders[0]!;
                    setShowMergeConfirm({
                      sourceId: id!,
                      targetId: target.id,
                      targetTable: target.table?.number ?? 0,
                    });
                  }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Fusionar ({mergeableOrders.length})
                </Button>
              )}
            </div>
          )}

          {canCancel && (
            <Button
              variant="ghost"
              className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
              onClick={() => setCancelTarget(true)}
            >
              Cancelar pedido
            </Button>
          )}

          {order.status === "preparing" && (
            <p className="text-center text-xs text-ink-muted py-1">Esperando la cocina...</p>
          )}

          {order.status === "cancelled" && (
            <p className="text-center text-xs text-red-400 py-1">Este pedido fue cancelado</p>
          )}

          {order.status === "served" && !canServe && (
            <p className="text-center text-xs text-emerald-400 py-1">Pedido servido</p>
          )}

          <Button variant="ghost" className="w-full" onClick={() => navigate("/tables")}>
            Volver a mesas
          </Button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={cancelTarget}
        title="Cancelar pedido"
        message={`¿Cancelar el pedido #${order.id.slice(0, 8)} de la mesa ${order.table?.number ?? "?"}?`}
        confirmLabel="Cancelar pedido"
        danger
        onConfirm={() => { cancelMut.mutate(); setCancelTarget(false); }}
        onCancel={() => setCancelTarget(false)}
      />

      <TablePickerModal
        isOpen={showTransfer}
        title="Transferir pedido"
        currentTableId={order.tableId}
        onSelect={(table) => transferMut.mutate({ tableId: table.id })}
        onCancel={() => setShowTransfer(false)}
      />

      {showMergeConfirm && (
        <ConfirmDialog
          isOpen
          title="Fusionar pedidos"
          message={`¿Fusionar este pedido con el otro pedido activo de la mesa ${showMergeConfirm.targetTable}? Los ítems se moverán al pedido destino y este pedido se cancelará.`}
          confirmLabel="Fusionar"
          onConfirm={() => mergeMut.mutate({ sourceId: showMergeConfirm.sourceId, targetId: showMergeConfirm.targetId })}
          onCancel={() => setShowMergeConfirm(null)}
        />
      )}
    </div>
  );
}
