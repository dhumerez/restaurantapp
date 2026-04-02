import { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as menuApi from "../../api/menu";
import * as ordersApi from "../../api/orders";
import { Header } from "../../components/layout/Header";
import { Button } from "../../components/ui/Button";
import { useToast } from "../../components/ui/Toast";
import { useSocket } from "../../context/SocketContext";
import { ordenEstado, itemEstado } from "../../utils/labels";
import { printReceipt } from "../../utils/printReceipt";
import { DiscountSection } from "../../components/order/DiscountSection";
import type { CartItem } from "../../types";

const itemStatusStyles: Record<string, string> = {
  pending:   "bg-blue-500/10 text-blue-400 border-blue-500/20",
  preparing: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  ready:     "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  served:    "bg-surface-2 text-ink-muted border-surface-border",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
};

const orderStatusStyles: Record<string, string> = {
  placed:    "bg-blue-500/10 text-blue-400 border-blue-500/20",
  preparing: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  ready:     "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  served:    "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
};

export function OrderPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const tableId = searchParams.get("table");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const socket = useSocket();

  const isNew = id === "new";
  const [orderId, setOrderId] = useState<string | null>(isNew ? null : id ?? null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [orderNotes, setOrderNotes] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [showCart, setShowCart] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: menuApi.getCategories,
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ["menuItems", selectedCategory],
    queryFn: () => menuApi.getMenuItems(selectedCategory ?? undefined),
  });

  const { data: existingOrder } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => ordersApi.getOrder(orderId!),
    enabled: !!orderId && !isNew,
  });

  useEffect(() => {
    if (!socket || !orderId) return;

    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    };

    const handleReady = () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      toast("¡Pedido listo!", "success");
    };

    socket.on("order:item-updated", handleUpdate);
    socket.on("order:ready", handleReady);

    return () => {
      socket.off("order:item-updated", handleUpdate);
      socket.off("order:ready", handleReady);
    };
  }, [socket, orderId, queryClient, toast]);

  useEffect(() => {
    if (existingOrder && existingOrder.status === "draft") {
      setCart(
        existingOrder.items.map((item) => ({
          menuItemId: item.menuItemId,
          name: item.itemName,
          price: parseFloat(item.unitPrice),
          quantity: item.quantity,
          notes: item.notes ?? undefined,
        }))
      );
      setOrderNotes(existingOrder.notes ?? "");
    }
  }, [existingOrder]);

  const createOrderMut = useMutation({
    mutationFn: (tId: string) => ordersApi.createOrder(tId),
    onSuccess: (order) => setOrderId(order.id),
  });

  const updateOrderMut = useMutation({
    mutationFn: () =>
      ordersApi.updateOrder(
        orderId!,
        cart.map((c) => ({ menuItemId: c.menuItemId, quantity: c.quantity, notes: c.notes })),
        orderNotes || undefined
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    },
  });

  const placeOrderMut = useMutation({
    mutationFn: () => ordersApi.placeOrder(orderId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast("¡Pedido enviado a cocina!", "success");
      navigate("/tables");
    },
    onError: () => toast("Error al enviar el pedido", "error"),
  });

  const serveOrderMut = useMutation({
    mutationFn: () => ordersApi.serveOrder(orderId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast("¡Pedido marcado como servido!", "success");
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    },
    onError: () => toast("Error al marcar como servido", "error"),
  });

  const addToCart = (item: { id: string; name: string; price: string; stockCount: number | null }) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      if (existing) {
        return prev.map((c) =>
          c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { menuItemId: item.id, name: item.name, price: parseFloat(item.price), quantity: 1 }];
    });
  };

  const updateQuantity = (menuItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => c.menuItemId === menuItemId ? { ...c, quantity: c.quantity + delta } : c)
        .filter((c) => c.quantity > 0)
    );
  };

  const updateItemNotes = (menuItemId: string, notes: string) => {
    setCart((prev) =>
      prev.map((c) => c.menuItemId === menuItemId ? { ...c, notes: notes || undefined } : c)
    );
  };

  const cartTotal = useMemo(
    () => cart.reduce((sum, c) => sum + c.price * c.quantity, 0),
    [cart]
  );

  const cartCount = useMemo(
    () => cart.reduce((sum, c) => sum + c.quantity, 0),
    [cart]
  );

  const handleSaveAndPlace = async () => {
    if (!orderId && tableId) {
      const order = await createOrderMut.mutateAsync(tableId);
      await ordersApi.updateOrder(
        order.id,
        cart.map((c) => ({ menuItemId: c.menuItemId, quantity: c.quantity, notes: c.notes })),
        orderNotes || undefined
      );
      await ordersApi.placeOrder(order.id);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast("¡Pedido enviado a cocina!", "success");
      navigate("/tables");
    } else if (orderId) {
      await updateOrderMut.mutateAsync();
      await placeOrderMut.mutateAsync();
    }
  };

  const handleSaveDraft = async () => {
    if (!orderId && tableId) {
      const order = await createOrderMut.mutateAsync(tableId);
      await ordersApi.updateOrder(
        order.id,
        cart.map((c) => ({ menuItemId: c.menuItemId, quantity: c.quantity, notes: c.notes })),
        orderNotes || undefined
      );
      toast("Borrador guardado", "info");
      navigate("/tables");
    } else if (orderId) {
      await updateOrderMut.mutateAsync();
      toast("Borrador guardado", "info");
    }
  };

  const startEditing = () => {
    if (!existingOrder) return;
    setCart(
      existingOrder.items
        .filter((i) => i.status !== "cancelled")
        .map((i) => ({
          menuItemId: i.menuItemId,
          name: i.itemName,
          price: parseFloat(i.unitPrice),
          quantity: i.quantity,
          notes: i.notes ?? undefined,
        }))
    );
    setOrderNotes(existingOrder.notes ?? "");
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setCart([]);
    setOrderNotes("");
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    await updateOrderMut.mutateAsync();
    setIsEditing(false);
    setCart([]);
    toast("Pedido actualizado", "success");
  };

  const isDraft = !existingOrder || existingOrder.status === "draft";
  const isActive = existingOrder &&
    existingOrder.status !== "draft" &&
    existingOrder.status !== "cancelled" &&
    existingOrder.status !== "served";

  const displayTotal = isDraft
    ? cartTotal.toFixed(2)
    : existingOrder?.total ?? "0.00";

  // Cart panel content (shared between mobile sheet and desktop sidebar)
  const cartPanel = (
    <>
      {/* Panel header */}
      <div className="p-4 border-b border-surface-border">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-ink-primary">
            {isDraft || isEditing ? "Pedido actual" : "Detalles del pedido"}
          </h3>
          {existingOrder && !isDraft && !isEditing && (
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize border ${
              orderStatusStyles[existingOrder.status] ?? "bg-surface-2 text-ink-muted border-surface-border"
            }`}>
              {ordenEstado[existingOrder.status] ?? existingOrder.status}
            </span>
          )}
          {isEditing && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/20">
              Editando
            </span>
          )}
        </div>
        {existingOrder?.table && (
          <p className="text-xs text-ink-muted mt-0.5">
            Mesa {existingOrder.table.number}
            {existingOrder.waiter && <span className="ml-1.5">· {existingOrder.waiter.name}</span>}
          </p>
        )}
      </div>

      {/* Scrollable items area */}
      <div className="flex-1 overflow-y-auto p-4">

        {/* DRAFT or EDITING: editable cart */}
        {(isDraft || isEditing) && cart.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <svg className="w-10 h-10 text-ink-muted mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-sm text-ink-muted">Toca ítems para agregar</p>
          </div>
        )}

        {(isDraft || isEditing) && cart.length > 0 && (
          <div className="space-y-3">
            {cart.map((item) => (
              <div key={item.menuItemId} className="pb-3 border-b border-surface-border last:border-0">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink-primary leading-snug">{item.name}</div>
                    <div className="text-xs text-ink-muted mt-0.5">Bs. {item.price.toFixed(2)} c/u</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => updateQuantity(item.menuItemId, -1)}
                      className="w-8 h-8 md:w-6 md:h-6 rounded-full bg-surface-2 hover:bg-surface-3 text-ink-secondary flex items-center justify-center transition-colors"
                    >
                      −
                    </button>
                    <span className="text-sm font-medium text-ink-primary w-5 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.menuItemId, 1)}
                      className="w-8 h-8 md:w-6 md:h-6 rounded-full bg-surface-2 hover:bg-surface-3 text-ink-secondary flex items-center justify-center transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <div className="text-sm font-semibold text-ink-primary w-16 text-right shrink-0">
                    Bs. {(item.price * item.quantity).toFixed(2)}
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Notas..."
                  value={item.notes ?? ""}
                  onChange={(e) => updateItemNotes(item.menuItemId, e.target.value)}
                  className="mt-1.5 w-full px-2.5 py-1.5 text-xs bg-surface-2 border border-surface-border rounded-lg
                    text-ink-secondary placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-primary-500/30 focus:border-primary-500/40 transition-colors"
                />
              </div>
            ))}
          </div>
        )}

        {/* NON-DRAFT (read-only view): show order details with item status */}
        {!isDraft && !isEditing && existingOrder && existingOrder.items.length > 0 && (
          <div className="space-y-2">
            {existingOrder.items.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded-xl border ${
                  item.status === "cancelled"
                    ? "border-surface-border bg-surface-2/30 opacity-50"
                    : "border-surface-border bg-surface-2/20"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium leading-snug ${item.status === "cancelled" ? "line-through text-ink-muted" : "text-ink-primary"}`}>
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
                  <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full border capitalize ${itemStatusStyles[item.status] ?? itemStatusStyles.pending}`}>
                    {itemEstado[item.status] ?? item.status}
                  </span>
                </div>
              </div>
            ))}

            {/* Order notes */}
            {existingOrder.notes && (
              <div className="mt-3 flex items-start gap-2 p-3 bg-amber-500/8 border border-amber-500/15 rounded-xl">
                <svg className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                <p className="text-xs text-amber-400">{existingOrder.notes}</p>
              </div>
            )}
          </div>
        )}

        {!isDraft && !isEditing && existingOrder && existingOrder.items.length === 0 && (
          <p className="text-sm text-ink-muted text-center py-8">Sin ítems en este pedido</p>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-surface-border space-y-3 pb-safe">
        {/* Draft or editing: order notes textarea */}
        {(isDraft || isEditing) && (
          <textarea
            placeholder="Notas del pedido..."
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            className="w-full px-3 py-2 bg-surface-2 border border-surface-border rounded-xl text-sm text-ink-primary
              placeholder:text-ink-muted resize-none h-14 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/50 transition-colors"
          />
        )}

        {/* Totals breakdown for non-draft (read-only view) */}
        {!isDraft && !isEditing && existingOrder && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-ink-muted">
              <span>Subtotal</span>
              <span>Bs. {parseFloat(existingOrder.subtotal).toFixed(2)}</span>
            </div>
            <DiscountSection
              order={existingOrder}
              onApplied={() => queryClient.invalidateQueries({ queryKey: ["order", orderId] })}
            />
            <div className="flex justify-between text-xs text-ink-muted">
              <span>Impuesto</span>
              <span>Bs. {parseFloat(existingOrder.tax).toFixed(2)}</span>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center pt-1 border-t border-surface-border">
          <span className="text-xs text-ink-muted uppercase tracking-widest">Total</span>
          <span className="text-xl font-bold text-ink-primary font-mono tabular-nums">
            Bs. {displayTotal}
          </span>
        </div>

        {/* Draft actions */}
        {isDraft && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" className="flex-1" onClick={handleSaveDraft} disabled={cart.length === 0}>
              Guardar borrador
            </Button>
            <Button size="sm" className="flex-1" onClick={handleSaveAndPlace} disabled={cart.length === 0}>
              Enviar a cocina
            </Button>
          </div>
        )}

        {/* Editing placed order actions */}
        {isEditing && (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="flex-1" onClick={cancelEditing}>
              Cancelar
            </Button>
            <Button size="sm" className="flex-1" onClick={handleSaveEdit} disabled={cart.length === 0 || updateOrderMut.isPending}>
              Guardar cambios
            </Button>
          </div>
        )}

        {/* Placed: edit button */}
        {existingOrder?.status === "placed" && !isEditing && (
          <Button variant="secondary" className="w-full" onClick={startEditing}>
            Editar pedido
          </Button>
        )}

        {/* Ready: mark served */}
        {existingOrder?.status === "ready" && !isEditing && (
          <Button className="w-full" onClick={() => serveOrderMut.mutate()} disabled={serveOrderMut.isPending}>
            Marcar como servido
          </Button>
        )}

        {/* Served / finished: print receipt */}
        {existingOrder && (existingOrder.status === "served" || existingOrder.status === "ready") && !isEditing && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => printReceipt(existingOrder)}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Imprimir recibo
          </Button>
        )}

        {/* Active: waiting message */}
        {isActive && existingOrder?.status !== "ready" && !isEditing && (
          <p className="text-center text-xs text-ink-muted py-1">Esperando la cocina...</p>
        )}

        {/* Cancelled */}
        {existingOrder?.status === "cancelled" && (
          <p className="text-center text-xs text-red-400 py-1">Este pedido fue cancelado</p>
        )}
      </div>
    </>
  );

  return (
    <div className="flex-1 flex flex-col bg-surface-0">
      <Header title={isNew ? "Nuevo pedido" : `Pedido #${orderId?.slice(0, 8)}`} />
      <div className="flex-1 flex overflow-hidden relative">

        {/* Menu browser */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Category tabs */}
          <div className="flex gap-1.5 px-3 md:px-4 py-2 md:py-3 bg-surface-1 border-b border-surface-border overflow-x-auto shrink-0 scrollbar-hide">
            <button
              className={`px-3 py-1.5 rounded-full text-xs md:text-sm font-medium whitespace-nowrap transition-all shrink-0 ${
                !selectedCategory
                  ? "bg-primary-500 text-ink-inverse"
                  : "text-ink-secondary hover:text-ink-primary hover:bg-surface-2"
              }`}
              onClick={() => setSelectedCategory(null)}
            >
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={`px-3 py-1.5 rounded-full text-xs md:text-sm font-medium whitespace-nowrap transition-all shrink-0 ${
                  selectedCategory === cat.id
                    ? "bg-primary-500 text-ink-inverse"
                    : "text-ink-secondary hover:text-ink-primary hover:bg-surface-2"
                }`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Items grid */}
          <div className="flex-1 overflow-y-auto p-3 md:p-4 pb-24 md:pb-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-2.5">
              {menuItems.map((item) => {
                const outOfStock = item.stockCount !== null && item.stockCount <= 0;
                const inCart = cart.find((c) => c.menuItemId === item.id);
                return (
                  <button
                    key={item.id}
                    disabled={outOfStock || (!isDraft && !isEditing)}
                    onClick={() => addToCart(item)}
                    className={`p-3 md:p-3.5 rounded-xl border text-left transition-all relative ${
                      outOfStock
                        ? "opacity-40 cursor-not-allowed bg-surface-1 border-surface-border"
                        : (isDraft || isEditing)
                          ? "bg-surface-1 border-surface-border hover:border-primary-500/40 hover:bg-surface-2/50 active:scale-[0.97]"
                          : "bg-surface-1 border-surface-border opacity-60 cursor-default"
                    } ${inCart ? "border-primary-500/30 bg-primary-500/5" : ""}`}
                  >
                    {inCart && (
                      <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary-500 text-ink-inverse text-xs font-bold flex items-center justify-center">
                        {inCart.quantity}
                      </span>
                    )}
                    <div className="text-xs md:text-sm font-medium text-ink-primary pr-6 leading-snug">{item.name}</div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-xs md:text-sm font-semibold text-primary-400">
                        Bs. {parseFloat(item.price).toFixed(2)}
                      </span>
                      {item.stockCount !== null && (
                        <span className={`text-[10px] md:text-xs ${outOfStock ? "text-red-400" : "text-ink-muted"}`}>
                          {outOfStock ? "Sin stock" : `${item.stockCount}`}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Desktop: Right panel */}
        <div className="hidden md:flex w-80 bg-surface-1 border-l border-surface-border flex-col">
          {cartPanel}
        </div>

        {/* Mobile: Floating cart button */}
        <div className="md:hidden fixed bottom-20 right-4 z-30">
          <button
            onClick={() => setShowCart(true)}
            className="relative w-14 h-14 rounded-2xl bg-primary-500 text-white shadow-lg shadow-primary-500/30
              flex items-center justify-center active:scale-95 transition-transform"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {cartCount}
              </span>
            )}
            {cartCount > 0 && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white bg-surface-0/80 px-1.5 rounded-full">
                Bs. {cartTotal.toFixed(0)}
              </span>
            )}
          </button>
        </div>

        {/* Mobile: Cart bottom sheet */}
        {showCart && (
          <div className="md:hidden fixed inset-0 z-50">
            <div className="fixed inset-0 bg-black/60" onClick={() => setShowCart(false)} />
            <div className="fixed bottom-0 left-0 right-0 bg-surface-1 border-t border-surface-border rounded-t-2xl max-h-[85vh] flex flex-col animate-slide-up">
              <div className="flex justify-center pt-2 pb-1">
                <div className="w-10 h-1 rounded-full bg-surface-border" />
              </div>
              <button
                onClick={() => setShowCart(false)}
                className="absolute top-3 right-3 p-2 text-ink-muted hover:text-ink-primary rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              {cartPanel}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
