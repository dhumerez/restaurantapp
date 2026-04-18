import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { trpc } from "../../../trpc.js";

export const Route = createFileRoute("/_app/platform/users")({
  component: PlatformUsersPage,
});

const ROLES = ["", "admin", "waiter", "kitchen", "cashier", "superadmin"] as const;

const emptyForm = {
  name: "",
  email: "",
  password: "",
  role: "",
  restaurantId: "",
};

function PlatformUsersPage() {
  const utils = trpc.useUtils();
  const { data: users = [] } = trpc.superadmin.users.list.useQuery();
  const { data: restaurants = [] } = trpc.superadmin.restaurants.list.useQuery();

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const create = trpc.superadmin.users.create.useMutation({
    onSuccess: () => {
      utils.superadmin.users.list.invalidate();
      utils.superadmin.pendingUsers.list.invalidate();
      setModalOpen(false);
      setForm(emptyForm);
    },
  });

  const q = search.toLowerCase();
  const filtered = (users as any[]).filter(
    (u: any) =>
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      name: form.name,
      email: form.email,
      password: form.password,
    };
    if (form.role !== "") payload.role = form.role;
    if (form.restaurantId !== "") payload.restaurantId = form.restaurantId;
    create.mutate(payload);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="bg-accent text-black font-semibold rounded-lg px-4 py-2 text-sm hover:bg-accent/80"
        >
          Crear usuario
        </button>
      </div>

      <input
        type="text"
        placeholder="Buscar por nombre o correo…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm"
      />

      {filtered.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-8 text-center text-muted">
          No se encontraron usuarios.
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-muted font-medium px-4 py-3">Nombre</th>
                <th className="text-left text-muted font-medium px-4 py-3">Correo</th>
                <th className="text-left text-muted font-medium px-4 py-3">Rol</th>
                <th className="text-left text-muted font-medium px-4 py-3">Restaurante</th>
                <th className="text-left text-muted font-medium px-4 py-3">Tier</th>
                <th className="text-left text-muted font-medium px-4 py-3">Activo</th>
                <th className="text-left text-muted font-medium px-4 py-3">Creado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user: any) => (
                <tr key={user.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{user.name}</td>
                  <td className="px-4 py-3 text-muted">{user.email}</td>
                  <td className="px-4 py-3 text-muted">{user.role ?? "—"}</td>
                  <td className="px-4 py-3">
                    {user.restaurant ? (
                      <Link
                        to="/platform/restaurants/$restaurantId"
                        params={{ restaurantId: user.restaurant.id }}
                        className="text-accent hover:underline"
                      >
                        {user.restaurant.name}
                      </Link>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {user.restaurant?.subscriptionTier ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {user.isActive ? "Sí" : "No"}
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="font-semibold text-lg">Crear usuario</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm text-muted mb-1">Nombre</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Correo</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Contraseña</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Rol</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">— Sin rol (pendiente) —</option>
                  {ROLES.filter((r) => r !== "").map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Restaurante</label>
                <select
                  value={form.restaurantId}
                  onChange={(e) => setForm((f) => ({ ...f, restaurantId: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">— Ninguno —</option>
                  {(restaurants as any[]).map((r: any) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              {create.error && (
                <p className="text-sm text-red-400">{create.error.message}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    setForm(emptyForm);
                    create.reset();
                  }}
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
