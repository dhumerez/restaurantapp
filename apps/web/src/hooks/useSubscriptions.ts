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
          title: "Order Ready",
          message: `Order is ready to serve`,
          url: `/waiter/orders/${data.order.id}`,
        });
      }
      if (data.event === "placed") {
        addNotification({
          type: "order_placed",
          title: "New Order",
          message: `New order placed`,
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
        title: "Low Stock Alert",
        message: `${data.ingredient.name}: ${data.ingredient.currentStock} ${data.ingredient.unit} remaining`,
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
