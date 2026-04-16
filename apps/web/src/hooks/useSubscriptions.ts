import { trpc } from "../trpc.js";
import { useNotificationStore } from "../store/notificationStore.js";
import { authClient } from "../auth.js";

/** Mount all 4 tRPC subscriptions once in the _app layout */
export function useSubscriptions() {
  const utils = trpc.useUtils();
  const addNotification = useNotificationStore((s) => s.addNotification);
  const { data: session } = authClient.useSession();
  const role = (session?.user as any)?.role;

  // Orders subscription — all restaurant staff
  trpc.notifications.orders.onChange.useSubscription(undefined, {
    enabled: !!session?.user,
    onData(data) {
      utils.orders.invalidate();
      utils.tables.invalidate();
      if (data.event === "ready") {
        const tableLabel = data.order.tableNumber
          ? `Mesa ${data.order.tableNumber}`
          : "un pedido";
        addNotification({
          type: "order_ready",
          title: "Pedido listo",
          message: `${tableLabel} está lista para servir`,
          url: `/waiter/orders/${data.order.id}`,
        });
      }
      if (data.event === "placed") {
        const tableLabel = data.order.tableNumber
          ? `Mesa ${data.order.tableNumber}`
          : "Nuevo pedido";
        const waiterSuffix = data.order.waiterName ? ` · ${data.order.waiterName}` : "";
        addNotification({
          type: "order_placed",
          title: "Nuevo pedido",
          message: `${tableLabel}${waiterSuffix}`,
        });
      }
    },
  });

  // Kitchen subscription
  trpc.notifications.kitchen.onChange.useSubscription(undefined, {
    enabled: role === "kitchen" || role === "admin",
    onData() {
      utils.kitchen.invalidate();
    },
  });

  // Inventory low stock — admin only
  trpc.notifications.inventory.onLowStock.useSubscription(undefined, {
    enabled: role === "admin",
    onData(data) {
      addNotification({
        type: "low_stock",
        title: "Alerta de stock bajo",
        message: `${data.ingredient.name}: quedan ${data.ingredient.currentStock} ${data.ingredient.unit}`,
        url: "/admin/inventory",
      });
    },
  });

  // Menu changes — all roles
  trpc.notifications.menu.onChange.useSubscription(undefined, {
    enabled: !!session?.user,
    onData() {
      utils.menu.invalidate();
    },
  });
}
