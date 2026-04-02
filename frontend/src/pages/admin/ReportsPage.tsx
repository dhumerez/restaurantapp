import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Header } from "../../components/layout/Header";
import * as reportsApi from "../../api/reports";

type RangeKey = "today" | "7d" | "30d" | "custom";

function getRange(key: RangeKey, customFrom?: string, customTo?: string): { from: Date; to: Date; group: "day" | "week" | "month" } {
  const now = new Date();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (key) {
    case "today":
      return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate()), to: endOfDay, group: "day" };
    case "7d": {
      const from = new Date(now);
      from.setDate(from.getDate() - 6);
      from.setHours(0, 0, 0, 0);
      return { from, to: endOfDay, group: "day" };
    }
    case "30d": {
      const from = new Date(now);
      from.setDate(from.getDate() - 29);
      from.setHours(0, 0, 0, 0);
      return { from, to: endOfDay, group: "day" };
    }
    case "custom": {
      const from = customFrom ? new Date(customFrom + "T00:00:00") : new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const to = customTo ? new Date(customTo + "T23:59:59.999") : endOfDay;
      const diffDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
      const group = diffDays > 90 ? "month" : diffDays > 14 ? "week" : "day";
      return { from, to, group };
    }
  }
}

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Hoy" },
  { key: "7d", label: "7 días" },
  { key: "30d", label: "30 días" },
  { key: "custom", label: "Personalizado" },
];

export function ReportsPage() {
  const [rangeKey, setRangeKey] = useState<RangeKey>("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const { from, to, group } = useMemo(() => getRange(rangeKey, customFrom, customTo), [rangeKey, customFrom, customTo]);

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["reports", "summary", from.toISOString(), to.toISOString()],
    queryFn: () => reportsApi.getSummary(from, to),
  });

  const { data: topItems = [] } = useQuery({
    queryKey: ["reports", "top-items", from.toISOString(), to.toISOString()],
    queryFn: () => reportsApi.getTopItems(from, to, 10),
  });

  const { data: revenueData = [] } = useQuery({
    queryKey: ["reports", "revenue", from.toISOString(), to.toISOString(), group],
    queryFn: () => reportsApi.getRevenueByPeriod(from, to, group),
  });

  const { data: waiterStats = [] } = useQuery({
    queryKey: ["reports", "waiters", from.toISOString(), to.toISOString()],
    queryFn: () => reportsApi.getByWaiter(from, to),
  });

  const { data: hourStats = [] } = useQuery({
    queryKey: ["reports", "hours", from.toISOString(), to.toISOString()],
    queryFn: () => reportsApi.getByHour(from, to),
  });

  const chartRevenue = revenueData.map((d) => ({
    name: formatPeriod(d.period, group),
    revenue: parseFloat(d.revenue),
    orders: d.orderCount,
  }));

  const chartHours = hourStats.map((d) => ({
    name: `${d.hour.toString().padStart(2, "0")}:00`,
    orders: d.orderCount,
    revenue: parseFloat(d.revenue),
  }));

  const maxTopRevenue = topItems.length > 0 ? Math.max(...topItems.map((i) => parseFloat(i.totalRevenue))) : 1;

  return (
    <div className="flex-1 bg-surface-0">
      <Header title="Reportes" />
      <div className="p-4 md:p-6 max-w-6xl space-y-4 md:space-y-6">
        {/* Date range filter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 bg-surface-1 border border-surface-border rounded-xl p-1">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setRangeKey(opt.key)}
                className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all whitespace-nowrap ${
                  rangeKey === opt.key
                    ? "bg-primary-500 text-ink-inverse shadow-sm"
                    : "text-ink-secondary hover:text-ink-primary"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {rangeKey === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-2 py-1.5 bg-surface-2 border border-surface-border rounded-lg text-xs text-ink-primary"
              />
              <span className="text-xs text-ink-muted">a</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2 py-1.5 bg-surface-2 border border-surface-border rounded-lg text-xs text-ink-primary"
              />
            </div>
          )}
        </div>

        {/* Summary cards */}
        {loadingSummary ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
            <SummaryCard label="Ingresos" value={`Bs. ${summary.totalRevenue}`} />
            <SummaryCard label="Pedidos" value={summary.totalOrders.toString()} />
            <SummaryCard label="Ticket promedio" value={`Bs. ${summary.avgTicket}`} />
            <SummaryCard label="Ítems vendidos" value={summary.totalItems.toString()} />
          </div>
        )}

        {/* Revenue chart */}
        {chartRevenue.length > 0 && (
          <div className="bg-surface-1 border border-surface-border rounded-2xl p-4 md:p-5">
            <h3 className="text-xs font-medium text-ink-muted uppercase tracking-widest mb-4">Ingresos por {group === "day" ? "día" : group === "week" ? "semana" : "mes"}</h3>
            <div className="h-52 md:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#888" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#888" }} tickLine={false} axisLine={false} width={50} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #333", borderRadius: "8px", fontSize: "12px" }}
                    labelStyle={{ color: "#aaa" }}
                    formatter={(value) => [`Bs. ${Number(value).toFixed(2)}`, "Ingresos"]}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: "#f59e0b" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {/* Top items */}
          {topItems.length > 0 && (
            <div className="bg-surface-1 border border-surface-border rounded-2xl p-4 md:p-5">
              <h3 className="text-xs font-medium text-ink-muted uppercase tracking-widest mb-3">Top ítems</h3>
              <div className="space-y-2">
                {topItems.map((item, i) => (
                  <div key={item.itemName} className="flex items-center gap-3">
                    <span className="text-xs font-mono text-ink-muted w-5 text-right shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-ink-primary truncate">{item.itemName}</span>
                        <span className="text-xs text-ink-muted shrink-0 ml-2">{item.totalQuantity} uds</span>
                      </div>
                      <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-500 rounded-full transition-all"
                          style={{ width: `${(parseFloat(item.totalRevenue) / maxTopRevenue) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-ink-primary font-mono tabular-nums shrink-0">
                      Bs. {item.totalRevenue}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Orders by hour */}
          {chartHours.length > 0 && (
            <div className="bg-surface-1 border border-surface-border rounded-2xl p-4 md:p-5">
              <h3 className="text-xs font-medium text-ink-muted uppercase tracking-widest mb-4">Pedidos por hora</h3>
              <div className="h-52 md:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartHours}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#888" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#888" }} tickLine={false} axisLine={false} width={30} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #333", borderRadius: "8px", fontSize: "12px" }}
                      labelStyle={{ color: "#aaa" }}
                      formatter={(value) => [value, "Pedidos"]}
                    />
                    <Bar dataKey="orders" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* Waiter performance */}
        {waiterStats.length > 0 && (
          <div className="bg-surface-1 border border-surface-border rounded-2xl overflow-hidden">
            <div className="px-4 md:px-5 py-3 border-b border-surface-border">
              <h3 className="text-xs font-medium text-ink-muted uppercase tracking-widest">Rendimiento por mesero</h3>
            </div>
            {/* Mobile: cards */}
            <div className="md:hidden divide-y divide-surface-border">
              {waiterStats.map((w) => (
                <div key={w.waiterId} className="p-4 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xs font-semibold text-blue-400 shrink-0">
                    {w.waiterName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-primary truncate">{w.waiterName}</p>
                    <p className="text-xs text-ink-muted">{w.totalOrders} pedidos · Prom. Bs. {w.avgTicket}</p>
                  </div>
                  <span className="text-sm font-semibold text-ink-primary font-mono tabular-nums">Bs. {w.totalRevenue}</span>
                </div>
              ))}
            </div>
            {/* Desktop: table */}
            <table className="hidden md:table w-full">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-ink-muted uppercase tracking-widest">Mesero</th>
                  <th className="text-right px-5 py-2.5 text-xs font-medium text-ink-muted uppercase tracking-widest">Pedidos</th>
                  <th className="text-right px-5 py-2.5 text-xs font-medium text-ink-muted uppercase tracking-widest">Ingresos</th>
                  <th className="text-right px-5 py-2.5 text-xs font-medium text-ink-muted uppercase tracking-widest">Ticket Prom.</th>
                </tr>
              </thead>
              <tbody>
                {waiterStats.map((w) => (
                  <tr key={w.waiterId} className="border-b border-surface-border last:border-0">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xs font-semibold text-blue-400 shrink-0">
                          {w.waiterName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-ink-primary">{w.waiterName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right text-sm text-ink-secondary font-mono tabular-nums">{w.totalOrders}</td>
                    <td className="px-5 py-3 text-right text-sm font-semibold text-ink-primary font-mono tabular-nums">Bs. {w.totalRevenue}</td>
                    <td className="px-5 py-3 text-right text-sm text-ink-secondary font-mono tabular-nums">Bs. {w.avgTicket}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-1 border border-surface-border rounded-2xl p-3 md:p-5">
      <p className="text-[10px] md:text-xs font-medium text-ink-muted uppercase tracking-widest mb-1 md:mb-2">{label}</p>
      <p className="text-lg md:text-2xl font-bold text-ink-primary font-mono tabular-nums">{value}</p>
    </div>
  );
}

function formatPeriod(dateStr: string, group: string): string {
  const d = new Date(dateStr);
  if (group === "month") return d.toLocaleDateString("es", { month: "short", year: "2-digit" });
  if (group === "week") return d.toLocaleDateString("es", { day: "2-digit", month: "short" });
  return d.toLocaleDateString("es", { day: "2-digit", month: "short" });
}
