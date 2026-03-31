import client from "./client";

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  currency: string;
  taxRate: string;
  status: "active" | "trial" | "suspended" | "inactive";
  createdAt: string;
  userCount?: number;
}

export interface RestaurantDetail extends Restaurant {
  userCount: number;
  totalOrders: number;
  totalRevenue: string;
}

export interface PlatformStats {
  totalRestaurants: number;
  activeUsers: number;
  todayOrders: number;
  todayRevenue: string;
}

export interface RestaurantUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateRestaurantInput {
  name: string;
  slug: string;
  address?: string;
  currency: string;
  taxRate: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

export async function getStats(): Promise<PlatformStats> {
  const { data } = await client.get<PlatformStats>("/superadmin/stats");
  return data;
}

export async function getRestaurants(): Promise<Restaurant[]> {
  const { data } = await client.get<Restaurant[]>("/superadmin/restaurants");
  return data;
}

export async function getRestaurant(id: string): Promise<RestaurantDetail> {
  const { data } = await client.get<RestaurantDetail>(`/superadmin/restaurants/${id}`);
  return data;
}

export async function createRestaurant(input: CreateRestaurantInput): Promise<{ restaurant: Restaurant; admin: RestaurantUser }> {
  const { data } = await client.post(`/superadmin/restaurants`, input);
  return data;
}

export async function updateRestaurant(
  id: string,
  input: Partial<{ name: string; address: string; currency: string; taxRate: string; status: string }>
): Promise<Restaurant> {
  const { data } = await client.put<Restaurant>(`/superadmin/restaurants/${id}`, input);
  return data;
}

export async function getRestaurantUsers(id: string): Promise<RestaurantUser[]> {
  const { data } = await client.get<RestaurantUser[]>(`/superadmin/restaurants/${id}/users`);
  return data;
}
