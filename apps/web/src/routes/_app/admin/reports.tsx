import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line
} from "recharts";
import { trpc } from "../../../trpc.js";
import { PeriodSelector } from "../../../components/PeriodSelector.js";

export const Route = createFileRoute("/_app/admin/reports")({
  component: ReportsPage,
});

type Period = "day" | "week" | "month";

function ReportsPage() {
  const [period, setPeriod] = useState<Period>("day");

  const { data: summary } = trpc.reports.orders.summary.useQuery({ period });
  const { data: revenue = [] } = trpc.reports.orders.revenue.useQuery({ period });
  const { data: topItems = [] } = trpc.reports.orders.topItems.useQuery({ period, limit: 10 });
  const { data: byWaiter = [] } = trpc.reports.orders.byWaiter.useQuery({ period });
  const { data: inventoryUsage = [] } = trpc.reports.inventory.usage.useQuery({ period });
  const { data: lowStock = [] } = trpc.reports.inventory.lowStock.useQuery();

  const revenueData = revenue.map((r: any) => ({
    label: new Date(r.period).toLocaleString("es", {
      hour: period === "day" ? "2-digit" : undefined,
      day: period !== "day" ? "2-digit" : undefined,
      month: period !== "day" ? "short" : undefined,
    }),
    revenue: Number(r.revenue).toFixed(2),
    orders: r.orderCount,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold">Reports</h1>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Orders" value={summary?.totalOrders ?? 0} />
        <StatCard label="Revenue" value={`$${Number(summary?.totalRevenue ?? 0).toFixed(2)}`} color="text-success" />
        <StatCard label="Tax Collected" value={`$${Number(summary?.totalTax ?? 0).toFixed(2)}`} />
        <StatCard label="Discounts Given" value={`$${Number(summary?.totalDiscounts ?? 0).toFixed(2)}`} color="text-destructive" />
      </div>

      {/* Revenue chart */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <h2 className="font-semibold mb-4">Revenue Over Time</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2128" />
            <XAxis dataKey="label" stroke="#6b7280" tick={{ fontSize: 11 }} />
            <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "#111318", border: "1px solid #1f2128", borderRadius: "8px" }}
              labelStyle={{ color: "#fff" }}
            />
            <Line type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2} dot={false} name="Revenue ($)" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top items + By waiter side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4">
          <h2 className="font-semibold mb-4">Top Selling Items</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topItems.map((i: any) => ({ name: i.itemName.substring(0, 12), qty: Number(i.totalQuantity) }))} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2128" />
              <XAxis type="number" stroke="#6b7280" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" stroke="#6b7280" tick={{ fontSize: 10 }} width={80} />
              <Tooltip contentStyle={{ background: "#111318", border: "1px solid #1f2128", borderRadius: "8px" }} />
              <Bar dataKey="qty" fill="#f59e0b" name="Qty sold" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <h2 className="font-semibold mb-4">Sales by Waiter</h2>
          <div className="space-y-2">
            {byWaiter.map((w: any) => (
              <div key={w.waiterId} className="flex items-center justify-between text-sm">
                <span>{w.waiterName}</span>
                <div className="text-right">
                  <div className="text-accent">${Number(w.totalRevenue).toFixed(2)}</div>
                  <div className="text-muted text-xs">{w.orderCount} orders</div>
                </div>
              </div>
            ))}
            {byWaiter.length === 0 && <p className="text-muted text-sm">No data for this period</p>}
          </div>
        </div>
      </div>

      {/* Inventory usage */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <h2 className="font-semibold mb-4">Ingredient Usage</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="pb-2">Ingredient</th>
                <th className="pb-2">Used</th>
                <th className="pb-2">Wasted</th>
                <th className="pb-2">Unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {inventoryUsage.map((i: any) => (
                <tr key={i.ingredientId}>
                  <td className="py-2">{i.ingredientName}</td>
                  <td className="py-2">{Number(i.totalUsed).toFixed(3)}</td>
                  <td className="py-2 text-muted">{Number(i.totalWasted).toFixed(3)}</td>
                  <td className="py-2 text-muted">{i.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Low stock snapshot */}
      {lowStock.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4">
          <h2 className="font-semibold text-destructive mb-3">Current Low Stock</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {lowStock.map((i: any) => (
              <div key={i.id} className="text-sm">
                <span className="font-medium">{i.name}</span>
                <span className="text-destructive ml-2">{i.currentStock} / {i.minStock} {i.unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color = "text-white" }: { label: string; value: any; color?: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="text-muted text-xs mb-1">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
