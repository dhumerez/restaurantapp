import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { trpc } from "../../../trpc.js";

export const Route = createFileRoute("/_app/platform/restaurants")({
  component: PlatformRestaurantsPage,
});

const STATUSES = ["active", "trial", "suspended", "inactive"] as const;

function statusBadgeClass(status: string) {
  switch (status) {
    case "active":
      return "bg-green-900/30 text-green-400 border-green-700";
    case "trial":
      return "bg-blue-900/30 text-blue-400 border-blue-700";
    case "suspended":
      return "bg-red-900/30 text-red-400 border-red-700";
    default:
      return "bg-gray-900/30 text-gray-400 border-gray-700";
  }
}

function PlatformRestaurantsPage() {
  const utils = trpc.useUtils();
  const { data: restaurants = [] } = trpc.superadmin.restaurants.list.useQuery();

  const create = trpc.superadmin.restaurants.create.useMutation({
    onSuccess: () => utils.superadmin.restaurants.list.invalidate(),
  });
  const update = trpc.superadmin.restaurants.update.useMutation({
    onSuccess: () => utils.superadmin.restaurants.list.invalidate(),
  });

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    address: "",
    currency: "USD",
    taxRate: "0",
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(
      {
        name: form.name,
        slug: form.slug,
        address: form.address || undefined,
        currency: form.currency,
        taxRate: Number(form.taxRate),
      },
      {
        onSuccess: () => {
          setShowModal(false);
          setForm({ name: "", slug: "", address: "", currency: "USD", taxRate: "0" });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Restaurantes</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-accent text-black font-semibold rounded-lg px-4 py-2 text-sm hover:bg-accent/80"
        >
          + Agregar restaurante
        </button>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-muted font-medium px-4 py-3">Nombre</th>
              <th className="text-left text-muted font-medium px-4 py-3">Slug</th>
              <th className="text-left text-muted font-medium px-4 py-3">Estado</th>
              <th className="text-left text-muted font-medium px-4 py-3">Moneda</th>
              <th className="text-left text-muted font-medium px-4 py-3">Cambiar estado</th>
            </tr>
          </thead>
          <tbody>
            {(restaurants as any[]).map((r: any) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">
                  <Link
                    to="/platform/restaurants/$restaurantId"
                    params={{ restaurantId: r.id }}
                    className="hover:underline"
                  >
                    {r.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted font-mono text-xs">{r.slug}</td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded border capitalize ${statusBadgeClass(r.status)}`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted">{r.currency}</td>
                <td className="px-4 py-3">
                  <select
                    value={r.status}
                    onChange={(e) => update.mutate({ id: r.id, status: e.target.value })}
                    className="bg-background border border-border rounded-lg px-2 py-1 text-sm"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="font-semibold text-lg">Agregar restaurante</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-sm text-muted mb-1">Nombre</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Slug</label>
                <input
                  required
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                  placeholder="my-restaurant"
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Dirección (opcional)</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Moneda</label>
                <input
                  value={form.currency}
                  onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Tasa de impuesto (%)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.taxRate}
                  onChange={(e) => setForm((f) => ({ ...f, taxRate: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border border-border rounded-lg px-4 py-2 text-sm hover:bg-background"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={create.isPending}
                  className="flex-1 bg-accent text-black font-semibold rounded-lg px-4 py-2 text-sm hover:bg-accent/80 disabled:opacity-50"
                >
                  {create.isPending ? "Creando…" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
