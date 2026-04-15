import EventEmitter from "eventemitter3";

// Per-restaurant event channels — only restaurant members receive events
// from their own restaurant

export type OrderChangeEvent = {
  event: "placed" | "updated" | "cancelled" | "served" | "ready";
  order: {
    id: string;
    status: string;
    tableId: string | null;
    waiterId: string;
    total: string;
    items: Array<{ id: string; status: string; itemName: string; quantity: number }>;
  };
};

export type KitchenChangeEvent = {
  event: "order_placed" | "item_status_changed" | "order_cancelled";
  order: {
    id: string;
    status: string;
    tableId: string | null;
    items: Array<{ id: string; status: string; itemName: string; quantity: number; notes: string | null }>;
  };
};

export type InventoryLowStockEvent = {
  ingredient: { id: string; name: string; unit: string; currentStock: string; minStock: string };
};

export type MenuChangeEvent = {
  event: "item_updated" | "item_deleted";
  menuItem: { id: string; name: string; isAvailable: boolean };
};

type Events = {
  [key: `orders:${string}`]: [OrderChangeEvent];
  [key: `kitchen:${string}`]: [KitchenChangeEvent];
  [key: `inventory:${string}`]: [InventoryLowStockEvent];
  [key: `menu:${string}`]: [MenuChangeEvent];
};

class RestaurantEmitter extends EventEmitter<Events> {
  emitOrderChange(restaurantId: string, data: OrderChangeEvent) {
    this.emit(`orders:${restaurantId}`, data);
  }
  emitKitchenChange(restaurantId: string, data: KitchenChangeEvent) {
    this.emit(`kitchen:${restaurantId}`, data);
  }
  emitInventoryLowStock(restaurantId: string, data: InventoryLowStockEvent) {
    this.emit(`inventory:${restaurantId}`, data);
  }
  emitMenuChange(restaurantId: string, data: MenuChangeEvent) {
    this.emit(`menu:${restaurantId}`, data);
  }
}

export const emitter = new RestaurantEmitter();
