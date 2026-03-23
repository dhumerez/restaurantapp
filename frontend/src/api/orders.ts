import client from "./client";
import type { Order, Table } from "../types";

export async function fetchTables(): Promise<Table[]> {
  const { data } = await client.get<Table[]>("/tables");
  return data;
}

export async function getOrders(status?: string, tableId?: string): Promise<Order[]> {
  const params: Record<string, string> = {};
  if (status) params.status = status;
  if (tableId) params.table = tableId;
  const { data } = await client.get<Order[]>("/orders", { params });
  return data;
}

export async function getOrder(id: string): Promise<Order> {
  const { data } = await client.get<Order>(`/orders/${id}`);
  return data;
}

export async function createOrder(tableId: string, notes?: string): Promise<Order> {
  const { data } = await client.post<Order>("/orders", { tableId, notes });
  return data;
}

export async function updateOrder(
  id: string,
  items: Array<{ menuItemId: string; quantity: number; notes?: string }>,
  notes?: string
): Promise<Order> {
  const { data } = await client.put<Order>(`/orders/${id}`, { items, notes });
  return data;
}

export async function placeOrder(id: string): Promise<Order> {
  const { data } = await client.post<Order>(`/orders/${id}/place`);
  return data;
}

export async function serveOrder(id: string): Promise<Order> {
  const { data } = await client.patch<Order>(`/orders/${id}/serve`);
  return data;
}

export async function cancelOrder(id: string): Promise<Order> {
  const { data } = await client.patch<Order>(`/orders/${id}/cancel`);
  return data;
}

// Kitchen
export async function getKitchenOrders(): Promise<Order[]> {
  const { data } = await client.get<Order[]>("/kitchen/orders");
  return data;
}

export async function updateItemStatus(
  itemId: string,
  status: "preparing" | "ready" | "served" | "cancelled"
): Promise<void> {
  await client.patch(`/kitchen/items/${itemId}/status`, { status });
}

export async function updateOrderStatus(
  orderId: string,
  status: "preparing" | "ready" | "served"
): Promise<void> {
  await client.patch(`/kitchen/orders/${orderId}/status`, { status });
}
