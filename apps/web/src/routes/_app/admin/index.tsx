import { createFileRoute } from "@tanstack/react-router";
import { trpc } from "../../../trpc.js";

export const Route = createFileRoute("/_app/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data: menuItems = [] } = trpc.menu.listItems.useQuery();
  const { data: staff = [] } = trpc.staff.list.useQuery();
  const { data: tables = [] } = trpc.tables.list.useQuery();
  const { data: ingredients = [] } = trpc.inventory.ingredients.list.useQuery();

  const lowStock = (ingredients as any[]).filter(
    (i: any) => Number(i.currentStock) <= Number(i.minStock)
  );

  const stats = [
    { label: "Menu Items", value: (menuItems as any[]).length, color: "text-accent" },
    { label: "Staff Members", value: (staff as any[]).length, color: "text-green-400" },
    { label: "Tables", value: (tables as any[]).length, color: "text-blue-400" },
    {
      label: "Low Stock Ingredients",
      value: lowStock.length,
      color: lowStock.length > 0 ? "text-amber-400" : "text-muted",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-surface border border-border rounded-xl p-5 space-y-1"
          >
            <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-sm text-muted">{stat.label}</div>
          </div>
        ))}
      </div>

      {lowStock.length > 0 && (
        <div className="bg-surface border border-amber-700 rounded-xl p-5">
          <h2 className="font-semibold text-amber-400 mb-3">Low Stock Alerts</h2>
          <div className="space-y-2">
            {lowStock.map((i: any) => (
              <div key={i.id} className="flex justify-between text-sm">
                <span>{i.name}</span>
                <span className="text-amber-400">
                  {i.currentStock} / {i.minStock} {i.unit}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
