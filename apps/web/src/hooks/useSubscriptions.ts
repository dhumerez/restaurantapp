import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "../trpc.js";
import { useNotificationStore } from "../store/notificationStore.js";
import { authClient } from "../auth.js";

/** Mount all 4 tRPC subscriptions once in the _app layout */
export function useSubscriptions() {
  const queryClient = useQueryClient();
  const addNotification = useNotificationStore((s) => s.addNotification);
  const { data: session } = authClient.useSession();
  const role = (session?.user as any)?.role;

  // Orders subscription — all restaurant staff
  trpc.notifications.orders.onChange.useSubscription(undefined, {
    enabled: !!session?.user,
    onData(data) {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      if (data.event === "ready") {
        addNotification({
          type: "order_ready",
          title: "Pedido listo",
          message: `El pedido está listo para servir`,
          url: `/waiter/orders/${data.order.id}`,
        });
      }
      if (data.event === "placed") {
        addNotification({
          type: "order_placed",
          title: "Nuevo pedido",
          message: `Se registró un nuevo pedido`,
        });
      }
    },
  });

  // Kitchen subscription
  trpc.notifications.kitchen.onChange.useSubscription(undefined, {
    enabled: role === "kitchen" || role === "admin",
    onData() {
      queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] });
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
      queryClient.invalidateQueries({ queryKey: ["menu"] });
    },
  });
}
