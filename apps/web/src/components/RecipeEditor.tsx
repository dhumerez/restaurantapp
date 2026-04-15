import { useState, useEffect } from "react";
import { trpc } from "../trpc.js";

interface RecipeRow {
  ingredientId: string;
  quantity: string;
}

interface RecipeEditorProps {
  menuItemId: string;
}

export function RecipeEditor({ menuItemId }: RecipeEditorProps) {
  const utils = trpc.useUtils();
  const { data: ingredients = [] } = trpc.inventory.ingredients.list.useQuery();
  const { data: recipe } = trpc.inventory.recipes.get.useQuery({ menuItemId });

  const [rows, setRows] = useState<RecipeRow[]>([]);

  useEffect(() => {
    if (recipe && (recipe as any[]).length > 0) {
      setRows(
        (recipe as any[]).map((r: any) => ({
          ingredientId: r.ingredientId,
          quantity: String(r.quantity),
        }))
      );
    }
  }, [recipe]);

  const upsert = trpc.inventory.recipes.upsert.useMutation({
    onSuccess: () => utils.inventory.recipes.get.invalidate({ menuItemId }),
  });

  const addRow = () =>
    setRows((prev) => [...prev, { ingredientId: "", quantity: "" }]);

  const removeRow = (idx: number) =>
    setRows((prev) => prev.filter((_, i) => i !== idx));

  const updateRow = (idx: number, field: keyof RecipeRow, value: string) =>
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r))
    );

  const save = () => {
    upsert.mutate({
      menuItemId,
      items: rows
        .filter((r) => r.ingredientId && r.quantity)
        .map((r) => ({ ingredientId: r.ingredientId, quantity: Number(r.quantity) })),
    });
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted uppercase tracking-wide">Receta</h3>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left text-muted font-medium pb-2 border-b border-border">Ingrediente</th>
            <th className="text-left text-muted font-medium pb-2 border-b border-border">Cantidad</th>
            <th className="pb-2 border-b border-border" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx}>
              <td className="py-1.5 pr-2">
                <select
                  value={row.ingredientId}
                  onChange={(e) => updateRow(idx, "ingredientId", e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm"
                >
                  <option value="">Seleccionar…</option>
                  {(ingredients as any[]).map((ing: any) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.unit})
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-1.5 pr-2">
                <input
                  type="number"
                  value={row.quantity}
                  onChange={(e) => updateRow(idx, "quantity", e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm"
                  placeholder="0"
                  min="0"
                  step="any"
                />
              </td>
              <td className="py-1.5">
                <button
                  onClick={() => removeRow(idx)}
                  className="border border-destructive text-destructive rounded-lg px-2 py-1 text-xs hover:bg-destructive/10"
                >
                  Quitar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex gap-2">
        <button
          onClick={addRow}
          className="border border-border text-sm rounded-lg px-3 py-1.5 hover:bg-surface"
        >
          + Agregar fila
        </button>
        <button
          onClick={save}
          disabled={upsert.isPending}
          className="bg-accent text-black font-semibold rounded-lg px-4 py-1.5 text-sm hover:bg-accent/80 disabled:opacity-50"
        >
          {upsert.isPending ? "Guardando…" : "Guardar receta"}
        </button>
      </div>
    </div>
  );
}
