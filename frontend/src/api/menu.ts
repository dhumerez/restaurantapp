import client from "./client";
import type { Category, MenuItem } from "../types";

export async function getCategories(): Promise<Category[]> {
  const { data } = await client.get<Category[]>("/categories");
  return data;
}

export async function createCategory(input: { name: string; sortOrder?: number }): Promise<Category> {
  const { data } = await client.post<Category>("/categories", input);
  return data;
}

export async function updateCategory(id: string, input: Partial<{ name: string; sortOrder: number }>): Promise<Category> {
  const { data } = await client.put<Category>(`/categories/${id}`, input);
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  await client.delete(`/categories/${id}`);
}

export async function getMenuItems(categoryId?: string): Promise<MenuItem[]> {
  const params = categoryId ? { category: categoryId } : {};
  const { data } = await client.get<MenuItem[]>("/menu-items", { params });
  return data;
}

export async function createMenuItem(input: {
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  stockCount?: number | null;
  isAvailable?: boolean;
}): Promise<MenuItem> {
  const { data } = await client.post<MenuItem>("/menu-items", input);
  return data;
}

export async function updateMenuItem(id: string, input: Partial<{
  categoryId: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  stockCount: number | null;
  isAvailable: boolean;
}>): Promise<MenuItem> {
  const { data } = await client.put<MenuItem>(`/menu-items/${id}`, input);
  return data;
}

export async function deleteMenuItem(id: string): Promise<void> {
  await client.delete(`/menu-items/${id}`);
}

export async function updateStock(id: string, stockCount: number | null): Promise<MenuItem> {
  const { data } = await client.patch<MenuItem>(`/menu-items/${id}/stock`, { stockCount });
  return data;
}

export async function uploadImage(id: string, file: File): Promise<MenuItem> {
  const form = new FormData();
  form.append("image", file);
  const { data } = await client.post<MenuItem>(`/menu-items/${id}/image`, form);
  return data;
}

export async function deleteImage(id: string): Promise<void> {
  await client.delete(`/menu-items/${id}/image`);
}
