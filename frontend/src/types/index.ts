export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "waiter" | "kitchen";
  restaurantId: string;
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
