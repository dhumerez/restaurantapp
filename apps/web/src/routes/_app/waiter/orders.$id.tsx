import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { trpc } from "../../../trpc.js";
import { Plus, Minus, Trash2, Send, X, Check } from "lucide-react";

export const Route = createFileRoute("/_app/waiter/orders/$id")({
  component: OrderPage,
});

function OrderPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const isNew = id === "new";
  const search = Route.useSearch() as { tableId?: string };

  const { data: categories = [] } = trpc.menu.listCategories.useQuery();
  const { data: menuItemsData = [] } = trpc.menu.listItems.useQuery();
  const { data: order } = trpc.orders.get.useQuery({ id }, { enabled: !isNew });
  const { data: tables = [] } = trpc.tables.list.useQuery();

  const activeTableId = isNew ? search.tableId : order?.tableId;
  const table = (tables as any[]).find((t) => t.id === activeTableId);

  const [cart, setCart] = useState<Map<string, { item: any; qty: number }>>(new Map());
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const utils = trpc.useUtils();
  const createOrder = trpc.orders.create.useMutation();
  const updateOrder = trpc.orders.update.useMutation();
  const placeOrder = trpc.orders.place.useMutation();
  const cancelOrder = trpc.orders.cancel.useMutation();
  const serveOrder = trpc.orders.serve.useMutation();

  const filteredItems = selectedCategory
    ? menuItemsData.filter((i: any) => i.categoryId === selectedCategory && i.isAvailable)
    : menuItemsData.filter((i: any) => i.isAvailable);

  const cartItems = Array.from(cart.values());
  const cartTotal = cartItems.reduce((s, { item, qty }) => s + Number(item.price) * qty, 0);

  function addToCart(item: any) {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(item.id);
      next.set(item.id, { item, qty: (existing?.qty ?? 0) + 1 });
      return next;
    });
  }

  function removeFromCart(itemId: string) {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(itemId);
      if (!existing || existing.qty <= 1) {
        next.delete(itemId);
      } else {
        next.set(itemId, { ...existing, qty: existing.qty - 1 });
      }
      return next;
    });
  }

  async function handleSendToKitchen() {
    if (cart.size === 0) return;
    setIsSending(true);
    try {
      let orderId = id;

      if (isNew) {
        const created = await createOrder.mutateAsync({ tableId: search.tableId! });
        orderId = created.id;
      }

      await updateOrder.mutateAsync({
        id: orderId,
        items: cartItems.map(({ item, qty }) => ({ menuItemId: item.id, quantity: qty })),
      });

      await placeOrder.mutateAsync({ id: orderId });
      navigate({ to: "/waiter/tables" });
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsSending(false);
    }
  }

  async function handleMarkServed() {
    if (!id || isNew) return;
    try {
      await serveOrder.mutateAsync({ id });
      await utils.orders.invalidate();
      await utils.tables.invalidate();
      navigate({ to: "/waiter/tables" });
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleCancel() {
    if (!id || isNew) { navigate({ to: "/waiter/tables" }); return; }
    if (!confirm("¿Cancelar este pedido?")) return;
    try {
      await cancelOrder.mutateAsync({ id });
      navigate({ to: "/waiter/tables" });
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 h-full">
      {/* Menu panel */}
      <div className="flex-1 min-w-0 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <button
              onClick={() => navigate({ to: "/waiter/tables" })}
              className="text-xs text-muted hover:text-white flex items-center gap-1 mb-1"
            >
              ← Volver a mesas
            </button>
            <h1 className="text-xl font-bold truncate">
              {table ? `Mesa ${table.number}${table.label ? ` · ${table.label}` : ""}` : "—"}
            </h1>
            <div className="text-xs text-muted mt-0.5">
              {isNew ? "Nuevo pedido" : `Pedido #${id.slice(0, 8)}`}
            </div>
          </div>
          {!isNew && order?.status && order.status !== "draft" && (
            <span className="text-xs bg-amber-900/30 text-amber-400 px-2 py-1 rounded capitalize shrink-0">{order.status}</span>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1 rounded-full text-sm ${!selectedCategory ? "bg-accent text-black" : "bg-surface border border-border text-muted"}`}
          >
            Todos
          </button>
          {categories.map((c: any) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3 py-1 rounded-full text-sm ${selectedCategory === c.id ? "bg-accent text-black" : "bg-surface border border-border text-muted"}`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filteredItems.map((item: any) => (
            <button
              key={item.id}
              onClick={() => addToCart(item)}
              className="bg-surface border border-border rounded-xl p-3 text-left hover:border-accent transition-colors"
            >
              {item.imageUrl && (
                <img src={item.imageUrl} alt={item.name} className="w-full h-24 object-cover rounded-lg mb-2" />
              )}
              <div className="font-medium text-sm">{item.name}</div>
              <div className="text-accent text-sm">${item.price}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Cart panel */}
      <div className="w-full md:w-72 bg-surface border border-border rounded-xl flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Carrito</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cartItems.length === 0 ? (
            <p className="text-muted text-sm text-center py-8">Agrega productos desde el menú</p>
          ) : (
            cartItems.map(({ item, qty }) => (
              <div key={item.id} className="flex items-center justify-between gap-2">
                <span className="text-sm flex-1 min-w-0 truncate">{item.name}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => removeFromCart(item.id)} className="p-1 text-muted hover:text-white">
                    <Minus size={14} />
                  </button>
                  <span className="text-sm w-5 text-center">{qty}</span>
                  <button onClick={() => addToCart(item)} className="p-1 text-muted hover:text-white">
                    <Plus size={14} />
                  </button>
                  <button onClick={() => { cart.delete(item.id); setCart(new Map(cart)); }} className="p-1 text-muted hover:text-destructive ml-1">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-border space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted">Subtotal</span>
            <span>${cartTotal.toFixed(2)}</span>
          </div>

          {!isNew && order?.status === "ready" && (
            <button
              onClick={handleMarkServed}
              disabled={serveOrder.isPending}
              className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Check size={16} />
              {serveOrder.isPending ? "Marcando…" : "Marcar como servido"}
            </button>
          )}

          <button
            onClick={handleSendToKitchen}
            disabled={cart.size === 0 || isSending}
            className="w-full bg-accent hover:bg-accent-hover text-black font-semibold py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Send size={16} />
            {isSending ? "Enviando…" : "Enviar a cocina"}
          </button>

          {!isNew && (
            <button
              onClick={handleCancel}
              className="w-full border border-destructive text-destructive hover:bg-destructive/10 py-2 rounded-lg text-sm flex items-center justify-center gap-2"
            >
              <X size={16} /> Cancelar pedido
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
