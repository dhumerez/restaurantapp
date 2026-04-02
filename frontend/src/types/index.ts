export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "waiter" | "kitchen" | "cashier" | "superadmin";
  restaurantId?: string;
  scope: "restaurant" | "platform";
}

export interface Category {
  id: string;
  restaurantId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  stockCount: number | null;
  isAvailable: boolean;
  sortOrder: number;
}

export interface Table {
  id: string;
  restaurantId: string;
  number: number;
  label: string | null;
  seats: number;
  isActive: boolean;
}

export interface Order {
  id: string;
  restaurantId: string;
  tableId: string;
  waiterId: string;
  status: "draft" | "placed" | "preparing" | "ready" | "served" | "cancelled";
  notes: string | null;
  discountType: "none" | "percentage" | "fixed";
  discountValue: string;
  discountAmount: string;
  discountReason: string | null;
  subtotal: string;
  tax: string;
  total: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  table?: Table;
  waiter?: { id: string; name: string };
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  quantity: number;
  unitPrice: string;
  itemName: string;
  notes: string | null;
  status: "pending" | "preparing" | "ready" | "served" | "cancelled";
  menuItem?: MenuItem;
}

export interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

export interface OrderEvent {
  id: string;
  orderId: string;
  userId: string;
  action:
    | "created"
    | "items_updated"
    | "placed"
    | "status_changed"
    | "item_status_changed"
    | "transferred"
    | "merged"
    | "discount_applied"
    | "served"
    | "cancelled";
  details: Record<string, unknown> | null;
  createdAt: string;
  userName: string;
  userRole: string;
}
