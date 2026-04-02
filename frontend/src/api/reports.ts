import client from "./client";

export interface ReportSummary {
  totalOrders: number;
  totalRevenue: string;
  avgTicket: string;
  totalItems: number;
}

export interface TopItem {
  itemName: string;
  totalQuantity: number;
  totalRevenue: string;
}

export interface RevenuePeriod {
  period: string;
  revenue: string;
  orderCount: number;
}

export interface WaiterStats {
  waiterId: string;
  waiterName: string;
  totalOrders: number;
  totalRevenue: string;
  avgTicket: string;
}

export interface HourStats {
  hour: number;
  orderCount: number;
  revenue: string;
}

function dateParams(from: Date, to: Date) {
  return { from: from.toISOString(), to: to.toISOString() };
}

export async function getSummary(from: Date, to: Date): Promise<ReportSummary> {
  const { data } = await client.get<ReportSummary>("/reports/summary", { params: dateParams(from, to) });
  return data;
}

export async function getTopItems(from: Date, to: Date, limit = 10): Promise<TopItem[]> {
  const { data } = await client.get<TopItem[]>("/reports/top-items", { params: { ...dateParams(from, to), limit } });
  return data;
}

export async function getRevenueByPeriod(from: Date, to: Date, group: "day" | "week" | "month" = "day"): Promise<RevenuePeriod[]> {
  const { data } = await client.get<RevenuePeriod[]>("/reports/revenue-by-period", { params: { ...dateParams(from, to), group } });
  return data;
}

export async function getByWaiter(from: Date, to: Date): Promise<WaiterStats[]> {
  const { data } = await client.get<WaiterStats[]>("/reports/by-waiter", { params: dateParams(from, to) });
  return data;
}

export async function getByHour(from: Date, to: Date): Promise<HourStats[]> {
  const { data } = await client.get<HourStats[]>("/reports/by-hour", { params: dateParams(from, to) });
  return data;
}
