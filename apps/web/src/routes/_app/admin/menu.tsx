import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { trpc } from "../../../trpc.js";
import { RecipeEditor } from "../../../components/RecipeEditor.js";

export const Route = createFileRoute("/_app/admin/menu")({
  component: AdminMenuPage,
});

function AdminMenuPage() {
  const utils = trpc.useUtils();
  const { data: categories = [] } = trpc.menu.listCategories.useQuery();
  const { data: items = [] } = trpc.menu.listItems.useQuery();

  const createCategory = trpc.menu.createCategory.useMutation({
    onSuccess: () => utils.menu.listCategories.invalidate(),
  });
  const createItem = trpc.menu.createItem.useMutation({
    onSuccess: () => utils.menu.listItems.invalidate(),
  });
  const updateItem = trpc.menu.updateItem.useMutation({
    onSuccess: () => utils.menu.listItems.invalidate(),
  });
  const deleteItem = trpc.menu.deleteItem.useMutation({
    onSuccess: () => utils.menu.listItems.invalidate(),
  });

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Category modal
  const [showCatModal, setShowCatModal] = useState(false);
  const [catName, setCatName] = useState("");

  // Add item modal
  const [showAddItem, setShowAddItem] = useState(false);
  const [addItemForm, setAddItemForm] = useState({
    name: "",
    description: "",
    price: "",
    categoryId: "",
  });

  // Edit item modal
  const [editItem, setEditItem] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: "", price: "", isAvailable: true });

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    createCategory.mutate(
      { name: catName },
      {
        onSuccess: () => {
          setShowCatModal(false);
          setCatName("");
        },
      }
    );
  };

  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    createItem.mutate(
      {
        name: addItemForm.name,
        description: addItemForm.description || undefined,
        price: Number(addItemForm.price),
        categoryId: addItemForm.categoryId,
      },
      {
        onSuccess: () => {
          setShowAddItem(false);
          setAddItemForm({ name: "", description: "", price: "", categoryId: "" });
        },
      }
    );
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setEditForm({ name: item.name, price: String(item.price), isAvailable: item.isAvailable });
  };

  const handleUpdateItem = (e: React.FormEvent) => {
    e.preventDefault();
    updateItem.mutate(
      {
        id: editItem.id,
        name: editForm.name,
        price: Number(editForm.price),
        isAvailable: editForm.isAvailable,
      },
      { onSuccess: () => setEditItem(null) }
    );
  };

  const filteredItems = selectedCategoryId
    ? (items as any[]).filter((i: any) => i.categoryId === selectedCategoryId)
    : (items as any[]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gestión del menú</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCatModal(true)}
            className="border border-border rounded-lg px-4 py-2 text-sm hover:bg-surface"
          >
            + Agregar categoría
          </button>
          <button
            onClick={() => setShowAddItem(true)}
            className="bg-accent text-black font-semibold rounded-lg px-4 py-2 text-sm hover:bg-accent/80"
          >
            + Agregar producto
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Category list */}
        <div className="w-48 shrink-0 space-y-1">
          <button
            onClick={() => setSelectedCategoryId(null)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              selectedCategoryId === null ? "bg-accent text-black font-semibold" : "hover:bg-surface"
            }`}
          >
            Todos los productos
          </button>
          {(categories as any[]).map((cat: any) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedCategoryId === cat.id
                  ? "bg-accent text-black font-semibold"
                  : "hover:bg-surface"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Items table */}
        <div className="flex-1 bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-muted font-medium px-4 py-3">Nombre</th>
                <th className="text-left text-muted font-medium px-4 py-3">Precio</th>
                <th className="text-left text-muted font-medium px-4 py-3">Disponible</th>
                <th className="text-left text-muted font-medium px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item: any) => (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3 text-accent">${item.price}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded border ${
                        item.isAvailable
                          ? "bg-green-900/30 text-green-400 border-green-700"
                          : "bg-gray-900/30 text-gray-400 border-gray-700"
                      }`}
                    >
                      {item.isAvailable ? "Sí" : "No"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(item)}
                        className="border border-border rounded-lg px-3 py-1 text-xs hover:bg-background"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => deleteItem.mutate({ id: item.id })}
                        className="border border-destructive text-destructive rounded-lg px-3 py-1 text-xs hover:bg-destructive/10"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted">
                    No hay productos en esta categoría.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Category modal */}
      {showCatModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="font-semibold text-lg">Agregar categoría</h2>
            <form onSubmit={handleCreateCategory} className="space-y-3">
              <div>
                <label className="block text-sm text-muted mb-1">Nombre</label>
                <input
                  required
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCatModal(false)}
                  className="flex-1 border border-border rounded-lg px-4 py-2 text-sm hover:bg-background"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createCategory.isPending}
                  className="flex-1 bg-accent text-black font-semibold rounded-lg px-4 py-2 text-sm hover:bg-accent/80 disabled:opacity-50"
                >
                  {createCategory.isPending ? "Agregando…" : "Agregar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Item modal */}
      {showAddItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="font-semibold text-lg">Agregar producto</h2>
            <form onSubmit={handleCreateItem} className="space-y-3">
              <div>
                <label className="block text-sm text-muted mb-1">Nombre</label>
                <input
                  required
                  value={addItemForm.name}
                  onChange={(e) => setAddItemForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Descripción (opcional)</label>
                <input
                  value={addItemForm.description}
                  onChange={(e) => setAddItemForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Precio ($)</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="any"
                  value={addItemForm.price}
                  onChange={(e) => setAddItemForm((f) => ({ ...f, price: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Categoría</label>
                <select
                  required
                  value={addItemForm.categoryId}
                  onChange={(e) => setAddItemForm((f) => ({ ...f, categoryId: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Selecciona una categoría…</option>
                  {(categories as any[]).map((cat: any) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddItem(false)}
                  className="flex-1 border border-border rounded-lg px-4 py-2 text-sm hover:bg-background"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createItem.isPending}
                  className="flex-1 bg-accent text-black font-semibold rounded-lg px-4 py-2 text-sm hover:bg-accent/80 disabled:opacity-50"
                >
                  {createItem.isPending ? "Agregando…" : "Agregar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Item modal */}
      {editItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="font-semibold text-lg">Editar — {editItem.name}</h2>
            <form onSubmit={handleUpdateItem} className="space-y-3">
              <div>
                <label className="block text-sm text-muted mb-1">Nombre</label>
                <input
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Precio ($)</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="any"
                  value={editForm.price}
                  onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="isAvailable"
                  type="checkbox"
                  checked={editForm.isAvailable}
                  onChange={(e) => setEditForm((f) => ({ ...f, isAvailable: e.target.checked }))}
                  className="w-4 h-4"
                />
                <label htmlFor="isAvailable" className="text-sm">Disponible</label>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditItem(null)}
                  className="flex-1 border border-border rounded-lg px-4 py-2 text-sm hover:bg-background"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={updateItem.isPending}
                  className="flex-1 bg-accent text-black font-semibold rounded-lg px-4 py-2 text-sm hover:bg-accent/80 disabled:opacity-50"
                >
                  {updateItem.isPending ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </form>

            <div className="border-t border-border pt-4">
              <RecipeEditor menuItemId={editItem.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
