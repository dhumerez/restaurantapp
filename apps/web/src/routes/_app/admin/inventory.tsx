import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { trpc } from "../../../trpc.js";

export const Route = createFileRoute("/_app/admin/inventory")({
  component: AdminInventoryPage,
});

const UNITS = ["g", "kg", "ml", "L", "units"] as const;

function AdminInventoryPage() {
  const utils = trpc.useUtils();
  const { data: ingredients = [] } = trpc.inventory.ingredients.list.useQuery();

  const createIngredient = trpc.inventory.ingredients.create.useMutation({
    onSuccess: () => utils.inventory.ingredients.list.invalidate(),
  });
  const restock = trpc.inventory.ingredients.restock.useMutation({
    onSuccess: () => utils.inventory.ingredients.list.invalidate(),
  });
  const remove = trpc.inventory.ingredients.delete.useMutation({
    onSuccess: () => utils.inventory.ingredients.list.invalidate(),
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    unit: "units",
    currentStock: "",
    minStock: "",
    costPerUnit: "",
  });

  const [restockTarget, setRestockTarget] = useState<any>(null);
  const [restockForm, setRestockForm] = useState({ quantity: "", notes: "" });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createIngredient.mutate(
      {
        name: addForm.name,
        unit: addForm.unit,
        currentStock: Number(addForm.currentStock),
        minStock: Number(addForm.minStock),
        costPerUnit: Number(addForm.costPerUnit),
      },
      {
        onSuccess: () => {
          setShowAddModal(false);
          setAddForm({ name: "", unit: "units", currentStock: "", minStock: "", costPerUnit: "" });
        },
      }
    );
  };

  const handleRestock = (e: React.FormEvent) => {
    e.preventDefault();
    restock.mutate(
      {
        id: restockTarget.id,
        quantity: Number(restockForm.quantity),
        notes: restockForm.notes || undefined,
      },
      {
        onSuccess: () => {
          setRestockTarget(null);
          setRestockForm({ quantity: "", notes: "" });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventario</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-accent text-black font-semibold rounded-lg px-4 py-2 text-sm hover:bg-accent/80"
        >
          + Agregar ingrediente
        </button>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-muted font-medium px-4 py-3">Nombre</th>
              <th className="text-left text-muted font-medium px-4 py-3">Unidad</th>
              <th className="text-left text-muted font-medium px-4 py-3">Stock</th>
              <th className="text-left text-muted font-medium px-4 py-3">Stock mínimo</th>
              <th className="text-left text-muted font-medium px-4 py-3">Costo/unidad</th>
              <th className="text-left text-muted font-medium px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(ingredients as any[]).map((ing: any) => {
              const isLow = Number(ing.currentStock) <= Number(ing.minStock);
              return (
                <tr
                  key={ing.id}
                  className={`border-b border-border last:border-0 ${isLow ? "bg-amber-900/10" : ""}`}
                >
                  <td className="px-4 py-3 font-medium">
                    {ing.name}
                    {isLow && (
                      <span className="ml-2 text-xs text-amber-400 border border-amber-700 rounded px-1">
                        Bajo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{ing.unit}</td>
                  <td className={`px-4 py-3 ${isLow ? "text-amber-400 font-semibold" : ""}`}>
                    {ing.currentStock}
                  </td>
                  <td className="px-4 py-3 text-muted">{ing.minStock}</td>
                  <td className="px-4 py-3 text-muted">${ing.costPerUnit}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setRestockTarget(ing)}
                        className="border border-border rounded-lg px-3 py-1 text-xs hover:bg-background"
                      >
                        Reabastecer
                      </button>
                      <button
                        onClick={() => remove.mutate({ id: ing.id })}
                        className="border border-destructive text-destructive rounded-lg px-3 py-1 text-xs hover:bg-destructive/10"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add ingredient modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="font-semibold text-lg">Agregar ingrediente</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-sm text-muted mb-1">Nombre</label>
                <input
                  required
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Unidad</label>
                <select
                  value={addForm.unit}
                  onChange={(e) => setAddForm((f) => ({ ...f, unit: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Stock actual</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="any"
                  value={addForm.currentStock}
                  onChange={(e) => setAddForm((f) => ({ ...f, currentStock: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Stock mínimo</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="any"
                  value={addForm.minStock}
                  onChange={(e) => setAddForm((f) => ({ ...f, minStock: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Costo por unidad ($)</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="any"
                  value={addForm.costPerUnit}
                  onChange={(e) => setAddForm((f) => ({ ...f, costPerUnit: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 border border-border rounded-lg px-4 py-2 text-sm hover:bg-background"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createIngredient.isPending}
                  className="flex-1 bg-accent text-black font-semibold rounded-lg px-4 py-2 text-sm hover:bg-accent/80 disabled:opacity-50"
                >
                  {createIngredient.isPending ? "Agregando…" : "Agregar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restock modal */}
      {restockTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="font-semibold text-lg">Reabastecer — {restockTarget.name}</h2>
            <form onSubmit={handleRestock} className="space-y-3">
              <div>
                <label className="block text-sm text-muted mb-1">
                  Cantidad a agregar ({restockTarget.unit})
                </label>
                <input
                  required
                  type="number"
                  min="0.01"
                  step="any"
                  value={restockForm.quantity}
                  onChange={(e) => setRestockForm((f) => ({ ...f, quantity: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Notas (opcional)</label>
                <input
                  value={restockForm.notes}
                  onChange={(e) => setRestockForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setRestockTarget(null)}
                  className="flex-1 border border-border rounded-lg px-4 py-2 text-sm hover:bg-background"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={restock.isPending}
                  className="flex-1 bg-accent text-black font-semibold rounded-lg px-4 py-2 text-sm hover:bg-accent/80 disabled:opacity-50"
                >
                  {restock.isPending ? "Guardando…" : "Reabastecer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
