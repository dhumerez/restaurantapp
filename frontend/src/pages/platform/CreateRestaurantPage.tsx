import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Header } from "../../components/layout/Header";
import * as superadminApi from "../../api/superadmin";

export function CreateRestaurantPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: "",
    slug: "",
    address: "",
    currency: "USD",
    taxRate: "0.00",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
  });

  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: superadminApi.createRestaurant,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["platform-restaurants"] });
      queryClient.invalidateQueries({ queryKey: ["platform-stats"] });
      navigate(`/platform/restaurants/${data.restaurant.id}`);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || "Error al crear el restaurante");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    mutation.mutate(form);
  };

  const handleNameChange = (name: string) => {
    setForm((f) => ({
      ...f,
      name,
      slug: name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-"),
    }));
  };

  return (
    <div className="flex-1 bg-surface-0">
      <Header title="Nuevo restaurante" />
      <div className="p-4 md:p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Restaurant info */}
          <div className="bg-surface-1 border border-surface-border rounded-2xl p-4 md:p-6">
            <h3 className="text-sm font-semibold text-ink-primary uppercase tracking-wider mb-4">Datos del restaurante</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5">Nombre</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-0 border border-surface-border rounded-lg text-sm text-ink-primary focus:outline-none focus:border-primary-500/50"
                  placeholder="Mi Restaurante"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5">Slug (URL)</label>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-ink-muted">/</span>
                  <input
                    type="text"
                    required
                    pattern="[a-z0-9-]+"
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                    className="flex-1 px-3 py-2 bg-surface-0 border border-surface-border rounded-lg text-sm text-ink-primary font-mono focus:outline-none focus:border-primary-500/50"
                    placeholder="mi-restaurante"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5">Direccion (opcional)</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="w-full px-3 py-2 bg-surface-0 border border-surface-border rounded-lg text-sm text-ink-primary focus:outline-none focus:border-primary-500/50"
                  placeholder="Av. Principal 123"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1.5">Moneda</label>
                  <input
                    type="text"
                    required
                    maxLength={3}
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 bg-surface-0 border border-surface-border rounded-lg text-sm text-ink-primary font-mono focus:outline-none focus:border-primary-500/50"
                    placeholder="USD"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1.5">Tasa de impuesto (%)</label>
                  <input
                    type="text"
                    required
                    value={form.taxRate}
                    onChange={(e) => setForm((f) => ({ ...f, taxRate: e.target.value }))}
                    className="w-full px-3 py-2 bg-surface-0 border border-surface-border rounded-lg text-sm text-ink-primary font-mono focus:outline-none focus:border-primary-500/50"
                    placeholder="10.00"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Admin user */}
          <div className="bg-surface-1 border border-surface-border rounded-2xl p-4 md:p-6">
            <h3 className="text-sm font-semibold text-ink-primary uppercase tracking-wider mb-4">Administrador inicial</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5">Nombre</label>
                <input
                  type="text"
                  required
                  value={form.adminName}
                  onChange={(e) => setForm((f) => ({ ...f, adminName: e.target.value }))}
                  className="w-full px-3 py-2 bg-surface-0 border border-surface-border rounded-lg text-sm text-ink-primary focus:outline-none focus:border-primary-500/50"
                  placeholder="Nombre del administrador"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={form.adminEmail}
                  onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))}
                  className="w-full px-3 py-2 bg-surface-0 border border-surface-border rounded-lg text-sm text-ink-primary focus:outline-none focus:border-primary-500/50"
                  placeholder="admin@restaurant.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5">Contrasena</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={form.adminPassword}
                  onChange={(e) => setForm((f) => ({ ...f, adminPassword: e.target.value }))}
                  className="w-full px-3 py-2 bg-surface-0 border border-surface-border rounded-lg text-sm text-ink-primary focus:outline-none focus:border-primary-500/50"
                  placeholder="Minimo 8 caracteres"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => navigate("/platform/restaurants")}
              className="px-4 py-2 text-sm font-medium text-ink-secondary hover:text-ink-primary border border-surface-border rounded-lg hover:bg-surface-2 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 bg-primary-500 text-surface-0 text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
            >
              {mutation.isPending ? "Creando..." : "Crear restaurante"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
