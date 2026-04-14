import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as menuApi from "../../api/menu";
import { Header } from "../../components/layout/Header";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../components/ui/Toast";
import type { Category, MenuItem } from "../../types";

export function MenuManagementPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categoryModal, setCategoryModal] = useState(false);
  const [itemModal, setItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: menuApi.getCategories,
  });

  const { data: menuItems = [], isPending: itemsPending } = useQuery({
    queryKey: ["menuItems", selectedCategoryId],
    queryFn: () => menuApi.getMenuItems(selectedCategoryId ?? undefined),
  });

  const createCategoryMut = useMutation({
    mutationFn: (input: { name: string }) => menuApi.createCategory(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setCategoryModal(false);
      toast("Categoría creada", "success");
    },
  });

  const updateCategoryMut = useMutation({
    mutationFn: ({ id, ...input }: { id: string; name: string }) =>
      menuApi.updateCategory(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setCategoryModal(false);
      setEditingCategory(null);
      toast("Categoría actualizada", "success");
    },
  });

  const deleteCategoryMut = useMutation({
    mutationFn: menuApi.deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setSelectedCategoryId(null);
      toast("Categoría eliminada", "success");
    },
  });

  const createItemMut = useMutation({
    mutationFn: menuApi.createMenuItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menuItems"] });
      setItemModal(false);
      toast("Ítem creado", "success");
    },
  });

  const updateItemMut = useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Parameters<typeof menuApi.updateMenuItem>[1]) =>
      menuApi.updateMenuItem(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menuItems"] });
      setItemModal(false);
      setEditingItem(null);
      toast("Ítem actualizado", "success");
    },
  });

  const deleteItemMut = useMutation({
    mutationFn: menuApi.deleteMenuItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menuItems"] });
      toast("Ítem eliminado", "success");
    },
  });

  const uploadImageMut = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => menuApi.uploadImage(id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menuItems"] });
      toast("Imagen subida", "success");
    },
    onError: () => toast("Error al subir imagen", "error"),
  });

  const deleteImageMut = useMutation({
    mutationFn: menuApi.deleteImage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menuItems"] });
      toast("Imagen eliminada", "success");
    },
  });

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  return (
    <div className="flex-1 bg-surface-0 flex flex-col">
      <Header title="Gestión de Menú" />

      {/* Mobile: horizontal category tabs */}
      <div className="md:hidden flex items-center gap-2 px-4 py-3 bg-surface-1 border-b border-surface-border overflow-x-auto scrollbar-hide shrink-0">
        <button
          onClick={() => { setEditingCategory(null); setCategoryModal(true); }}
          className="w-8 h-8 rounded-lg bg-primary-500/10 hover:bg-primary-500/20 border border-primary-500/20 text-primary-400 flex items-center justify-center shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <button
          className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all shrink-0 ${
            !selectedCategoryId
              ? "bg-primary-500 text-ink-inverse"
              : "text-ink-secondary hover:text-ink-primary hover:bg-surface-2"
          }`}
          onClick={() => setSelectedCategoryId(null)}
        >
          Todos
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all shrink-0 ${
              selectedCategoryId === cat.id
                ? "bg-primary-500 text-ink-inverse"
                : "text-ink-secondary hover:text-ink-primary hover:bg-surface-2"
            }`}
            onClick={() => setSelectedCategoryId(cat.id)}
            onDoubleClick={() => { setEditingCategory(cat); setCategoryModal(true); }}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Desktop: Categories sidebar */}
        <div className="hidden md:block w-56 shrink-0 p-6 pr-0">
          <div className="bg-surface-1 border border-surface-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
              <span className="text-xs font-medium text-ink-muted uppercase tracking-widest">Categorías</span>
              <button
                onClick={() => { setEditingCategory(null); setCategoryModal(true); }}
                className="w-6 h-6 rounded-md bg-primary-500/10 hover:bg-primary-500/20 border border-primary-500/20 text-primary-400 flex items-center justify-center transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
            <nav className="p-1.5 space-y-0.5">
              <button
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  !selectedCategoryId
                    ? "bg-primary-500/12 text-primary-400 border border-primary-500/20"
                    : "text-ink-secondary hover:text-ink-primary hover:bg-surface-2 border border-transparent"
                }`}
                onClick={() => setSelectedCategoryId(null)}
              >
                Todos
              </button>
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center group">
                  <button
                    className={`flex-1 text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedCategoryId === cat.id
                        ? "bg-primary-500/12 text-primary-400 border border-primary-500/20"
                        : "text-ink-secondary hover:text-ink-primary hover:bg-surface-2 border border-transparent"
                    }`}
                    onClick={() => setSelectedCategoryId(cat.id)}
                  >
                    {cat.name}
                  </button>
                  <button
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-ink-muted hover:text-primary-400 transition-all shrink-0"
                    onClick={() => { setEditingCategory(cat); setCategoryModal(true); }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </div>
              ))}
            </nav>
          </div>
        </div>

        {/* Menu items */}
        <div className="flex-1 min-w-0 p-4 md:p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-base md:text-lg font-semibold text-ink-primary tracking-wide">
                {selectedCategory?.name ?? "Todos"}
              </h3>
              <p className="text-xs text-ink-muted mt-0.5">{menuItems.length} ítem{menuItems.length !== 1 ? "s" : ""}</p>
            </div>
            <Button size="sm" onClick={() => { setEditingItem(null); setItemModal(true); }}>
              + Agregar ítem
            </Button>
          </div>

          {itemsPending ? (
            <div className="bg-surface-1 border border-surface-border rounded-2xl p-12 md:p-16 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto" />
            </div>
          ) : menuItems.length === 0 ? (
            <div className="bg-surface-1 border border-surface-border rounded-2xl p-12 md:p-16 text-center">
              <svg className="w-12 h-12 text-ink-muted mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <p className="text-sm text-ink-muted">Sin ítems en el menú</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {menuItems.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  onEdit={() => { setEditingItem(item); setItemModal(true); }}
                  onDelete={() => deleteItemMut.mutate(item.id)}
                  onUploadImage={(file) => uploadImageMut.mutate({ id: item.id, file })}
                  onDeleteImage={() => deleteImageMut.mutate(item.id)}
                  isUploading={uploadImageMut.isPending}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Category Modal */}
      <Modal
        isOpen={categoryModal}
        onClose={() => { setCategoryModal(false); setEditingCategory(null); }}
        title={editingCategory ? "Editar categoría" : "Nueva categoría"}
      >
        <CategoryForm
          initial={editingCategory}
          onSubmit={(data) => {
            if (editingCategory) {
              updateCategoryMut.mutate({ id: editingCategory.id, ...data });
            } else {
              createCategoryMut.mutate(data);
            }
          }}
          onDelete={
            editingCategory
              ? () => {
                  deleteCategoryMut.mutate(editingCategory.id);
                  setCategoryModal(false);
                  setEditingCategory(null);
                }
              : undefined
          }
        />
      </Modal>

      {/* Menu Item Modal */}
      <Modal
        isOpen={itemModal}
        onClose={() => { setItemModal(false); setEditingItem(null); }}
        title={editingItem ? "Editar ítem" : "Nuevo ítem"}
      >
        <MenuItemForm
          initial={editingItem}
          categories={categories}
          defaultCategoryId={selectedCategoryId}
          onSubmit={(data) => {
            if (editingItem) {
              updateItemMut.mutate({ id: editingItem.id, ...data });
            } else {
              createItemMut.mutate(data as Parameters<typeof menuApi.createMenuItem>[0]);
            }
          }}
        />
      </Modal>
    </div>
  );
}

function CategoryForm({
  initial,
  onSubmit,
  onDelete,
}: {
  initial: Category | null;
  onSubmit: (data: { name: string }) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name });
      }}
      className="space-y-4"
    >
      <Input label="Nombre de categoría" value={name} onChange={(e) => setName(e.target.value)} required />
      <div className="flex justify-between pt-1">
        {onDelete && (
          <Button type="button" variant="danger" onClick={onDelete}>
            Eliminar
          </Button>
        )}
        <Button type="submit" className="ml-auto">
          {initial ? "Actualizar" : "Crear"}
        </Button>
      </div>
    </form>
  );
}

function MenuItemForm({
  initial,
  categories,
  defaultCategoryId,
  onSubmit,
}: {
  initial: MenuItem | null;
  categories: Category[];
  defaultCategoryId: string | null;
  onSubmit: (data: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState(initial ? parseFloat(initial.price).toString() : "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? defaultCategoryId ?? "");
  const [trackStock, setTrackStock] = useState(initial?.stockCount !== null);
  const [stockCount, setStockCount] = useState(initial?.stockCount?.toString() ?? "0");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          name,
          description: description || undefined,
          price: parseFloat(price),
          categoryId,
          stockCount: trackStock ? parseInt(stockCount) : null,
          isAvailable: true,
        });
      }}
      className="space-y-4"
    >
      <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input label="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} />
      <Input label="Precio" type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} required />

      <div>
        <label className="block text-xs font-medium text-ink-secondary uppercase tracking-widest mb-1.5">Categoría</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full px-3 py-3 md:py-2.5 bg-surface-2 border border-surface-border rounded-xl text-sm text-ink-primary
            focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/50 transition-colors min-h-[2.75rem]"
          required
        >
          <option value="">Seleccionar categoría</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="flex items-center gap-2.5 cursor-pointer min-h-[2.75rem]">
          <input
            type="checkbox"
            checked={trackStock}
            onChange={(e) => setTrackStock(e.target.checked)}
            className="w-5 h-5 rounded border-surface-border bg-surface-2 text-primary-500 focus:ring-primary-500/30"
          />
          <span className="text-sm text-ink-secondary">Controlar inventario</span>
        </label>
        {trackStock && (
          <Input
            type="number"
            min="0"
            value={stockCount}
            onChange={(e) => setStockCount(e.target.value)}
            className="mt-2"
          />
        )}
      </div>

      <Button type="submit" className="w-full mt-2">
        {initial ? "Actualizar ítem" : "Crear ítem"}
      </Button>
    </form>
  );
}

function MenuItemCard({
  item,
  onEdit,
  onDelete,
  onUploadImage,
  onDeleteImage,
  isUploading,
}: {
  item: MenuItem;
  onEdit: () => void;
  onDelete: () => void;
  onUploadImage: (file: File) => void;
  onDeleteImage: () => void;
  isUploading: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="bg-surface-1 border border-surface-border rounded-xl overflow-hidden hover:border-surface-border-light transition-colors group">
      {/* Image area */}
      <div className="relative aspect-[16/10] bg-surface-2">
        {item.imageUrl ? (
          <>
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-full h-full object-cover"
            />
            <button
              onClick={onDeleteImage}
              className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/50 hover:bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
              title="Eliminar imagen"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={isUploading}
            className="w-full h-full flex flex-col items-center justify-center text-ink-muted hover:text-primary-400 hover:bg-surface-2/80 transition-colors"
          >
            {isUploading ? (
              <span className="text-xs">Subiendo...</span>
            ) : (
              <>
                <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-[10px]">Agregar imagen</span>
              </>
            )}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUploadImage(file);
            e.target.value = "";
          }}
        />
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h4 className="font-medium text-ink-primary text-sm leading-snug flex-1 pr-2">{item.name}</h4>
          <span className="text-base font-semibold text-primary-400 shrink-0 font-mono tabular-nums">
            Bs. {parseFloat(item.price).toFixed(2)}
          </span>
        </div>
        {item.description && (
          <p className="text-xs text-ink-muted mb-3 leading-relaxed">{item.description}</p>
        )}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-surface-border">
          <span className="text-xs text-ink-muted">
            {item.stockCount !== null ? `${item.stockCount} en stock` : "Ilimitado"}
          </span>
          <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            {item.imageUrl && (
              <button
                className="p-2 text-ink-muted hover:text-primary-400 hover:bg-primary-500/10 rounded-lg transition-colors"
                onClick={() => fileRef.current?.click()}
                title="Cambiar imagen"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
            )}
            <button
              className="p-2 text-ink-muted hover:text-primary-400 hover:bg-primary-500/10 rounded-lg transition-colors"
              onClick={onEdit}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            <button
              className="p-2 text-ink-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              onClick={onDelete}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
