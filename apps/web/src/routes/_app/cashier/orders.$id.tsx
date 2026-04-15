import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { trpc } from "../../../trpc.js";
import { Printer, CheckCircle, X, Percent } from "lucide-react";

export const Route = createFileRoute("/_app/cashier/orders/$id")({
  component: CashierOrderPage,
});

function CashierOrderPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: order, isLoading } = trpc.orders.get.useQuery({ id });
  const utils = trpc.useUtils();

  const serve = trpc.orders.serve.useMutation({
    onSuccess: () => { utils.orders.list.invalidate(); navigate({ to: "/cashier/tables" }); },
  });
  const cancel = trpc.orders.cancel.useMutation({
    onSuccess: () => { utils.orders.list.invalidate(); navigate({ to: "/cashier/tables" }); },
  });
  const applyDiscount = trpc.orders.applyDiscount.useMutation({
    onSuccess: () => utils.orders.get.invalidate({ id }),
  });

  const [discountModal, setDiscountModal] = useState(false);
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState("");

  async function handleDiscount() {
    await applyDiscount.mutateAsync({
      id,
      type: discountType,
      value: Number(discountValue),
    });
    setDiscountModal(false);
  }

  function handlePrint() {
    window.print();
  }

  if (isLoading || !order) return <div className="text-muted">Cargando…</div>;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Detalle del pedido</h1>
        <span className={`text-xs px-2 py-1 rounded capitalize font-medium ${
          order.status === "ready" ? "bg-green-900/30 text-green-400 border border-green-700" : "bg-amber-900/30 text-amber-400 border border-amber-700"
        }`}>{order.status}</span>
      </div>

      <div className="bg-surface border border-border rounded-xl divide-y divide-border">
        {order.items.map((item: any) => (
          <div key={item.id} className="flex justify-between px-4 py-3 text-sm">
            <span>{item.quantity}× {item.itemName}</span>
            <span>${(Number(item.unitPrice) * item.quantity).toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-xl p-4 space-y-2 text-sm">
        <div className="flex justify-between text-muted">
          <span>Subtotal</span><span>${order.subtotal}</span>
        </div>
        <div className="flex justify-between text-muted">
          <span>Impuesto</span><span>${order.tax}</span>
        </div>
        {order.discountType !== "none" && (
          <div className="flex justify-between text-destructive">
            <span>Descuento ({order.discountType} {order.discountValue})</span>
            <span>-${order.discountAmount}</span>
          </div>
        )}
        <div className="flex justify-between font-bold border-t border-border pt-2">
          <span>Total</span><span>${order.total}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setDiscountModal(true)}
          className="flex items-center justify-center gap-2 border border-border rounded-lg py-3 text-sm hover:bg-surface transition-colors"
        >
          <Percent size={16} /> Descuento
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center justify-center gap-2 border border-border rounded-lg py-3 text-sm hover:bg-surface transition-colors"
        >
          <Printer size={16} /> Imprimir recibo
        </button>
        <button
          onClick={() => cancel.mutate({ id })}
          disabled={cancel.isPending}
          className="flex items-center justify-center gap-2 border border-destructive text-destructive rounded-lg py-3 text-sm hover:bg-destructive/10 transition-colors"
        >
          <X size={16} /> Cancelar pedido
        </button>
        <button
          onClick={() => serve.mutate({ id })}
          disabled={serve.isPending || order.status !== "ready"}
          className="flex items-center justify-center gap-2 bg-success hover:bg-success/80 text-black font-semibold rounded-lg py-3 text-sm disabled:opacity-50"
        >
          <CheckCircle size={16} /> Marcar como servido
        </button>
      </div>

      {discountModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="font-semibold">Aplicar descuento</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setDiscountType("percentage")}
                className={`flex-1 py-2 rounded-lg text-sm ${discountType === "percentage" ? "bg-accent text-black" : "border border-border"}`}
              >% Porcentaje</button>
              <button
                onClick={() => setDiscountType("fixed")}
                className={`flex-1 py-2 rounded-lg text-sm ${discountType === "fixed" ? "bg-accent text-black" : "border border-border"}`}
              >$ Monto fijo</button>
            </div>
            <input
              type="number"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
              placeholder={discountType === "percentage" ? "ej. 10 (para 10%)" : "ej. 5.00"}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
            />
            <div className="flex gap-2">
              <button onClick={() => setDiscountModal(false)} className="flex-1 border border-border py-2 rounded-lg text-sm">Cancelar</button>
              <button onClick={handleDiscount} className="flex-1 bg-accent text-black py-2 rounded-lg text-sm font-semibold">Aplicar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
