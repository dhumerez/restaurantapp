import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Header } from "../../components/layout/Header";
import { useToast } from "../../components/ui/Toast";
import { Modal } from "../../components/ui/Modal";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import type { Table } from "../../types";
import client from "../../api/client";

async function getTables(): Promise<Table[]> {
  const { data } = await client.get<Table[]>("/tables");
  return data;
}

async function createTable(input: { number: number; label?: string; seats: number }): Promise<Table> {
  const { data } = await client.post<Table>("/tables", input);
  return data;
}

async function updateTable(id: string, input: Partial<{ number: number; label: string; seats: number; isActive: boolean }>): Promise<Table> {
  const { data } = await client.put<Table>(`/tables/${id}`, input);
  return data;
}

async function deleteTable(id: string): Promise<void> {
  await client.delete(`/tables/${id}`);
}

export function TableManagementPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Table | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Table | null>(null);

  const { data: tables = [], isLoading } = useQuery({
    queryKey: ["admin-tables"],
    queryFn: getTables,
  });

  const createMut = useMutation({
    mutationFn: createTable,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tables"] });
      toast("Mesa creada", "success");
      setShowModal(false);
    },
    onError: () => toast("Error al crear mesa", "error"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Parameters<typeof updateTable>[1]) =>
      updateTable(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tables"] });
      toast("Mesa actualizada", "success");
      setShowModal(false);
      setEditing(null);
    },
    onError: () => toast("Error al actualizar mesa", "error"),
  });

  const deleteMut = useMutation({
    mutationFn: deleteTable,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tables"] });
      toast("Mesa eliminada", "success");
    },
    onError: () => toast("Error al eliminar mesa", "error"),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const number = parseInt(form.get("number") as string, 10);
    const label = (form.get("label") as string) || undefined;
    const seats = parseInt(form.get("seats") as string, 10);

    if (editing) {
      updateMut.mutate({ id: editing.id, number, label, seats });
    } else {
      createMut.mutate({ number, label, seats });
    }
  };

  const sortedTables = [...tables].sort((a, b) => a.number - b.number);

  return (
    <div className="flex-1 bg-surface-0">
      <Header title="Gestión de Mesas" />
      <div className="p-6 max-w-5xl">
        <div className="flex justify-between items-center mb-5">
          <p className="text-sm text-ink-muted">
            {tables.length} mesa{tables.length !== 1 ? "s" : ""}
          </p>
          <Button size="sm" onClick={() => { setEditing(null); setShowModal(true); }}>
            + Agregar mesa
          </Button>
        </div>

        {isLoading ? (
          <div className="bg-surface-1 border border-surface-border rounded-2xl p-16 text-center">
            <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto" />
          </div>
        ) : tables.length === 0 ? (
          <div className="bg-surface-1 border border-surface-border rounded-2xl p-16 text-center">
            <svg className="w-12 h-12 text-ink-muted mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 10h18M3 14h18M10 3v18M14 3v18" />
            </svg>
            <p className="text-sm text-ink-muted">Sin mesas aún</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {sortedTables.map((table) => (
              <div
                key={table.id}
                className={`bg-surface-1 border border-surface-border rounded-xl p-4 text-center group hover:border-surface-border-light transition-all ${
                  !table.isActive ? "opacity-40" : ""
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-primary-500/10 border border-primary-500/15 flex items-center justify-center mx-auto mb-2">
                  <span className="text-lg font-bold text-primary-400 font-mono tabular-nums">
                    {table.number}
                  </span>
                </div>
                {table.label && (
                  <div className="text-xs text-ink-muted mb-0.5 truncate">{table.label}</div>
                )}
                <div className="text-xs text-ink-muted mb-3">{table.seats} asientos</div>
                <div className="flex justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setEditing(table); setShowModal(true); }}
                    className="text-xs text-ink-muted hover:text-primary-400 font-medium transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => setDeleteTarget(table)}
                    className="text-xs text-ink-muted hover:text-red-400 font-medium transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Eliminar mesa"
        message={`¿Eliminar mesa ${deleteTarget?.number}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        danger
        onConfirm={() => { deleteMut.mutate(deleteTarget!.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />

      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditing(null); }}
        title={editing ? "Editar mesa" : "Agregar mesa"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Número de mesa"
            name="number"
            type="number"
            min={1}
            defaultValue={editing?.number ?? ""}
            required
          />
          <div>
            <label className="block text-xs font-medium text-ink-secondary uppercase tracking-widest mb-1.5">
              Etiqueta <span className="text-ink-muted normal-case tracking-normal font-normal">(opcional)</span>
            </label>
            <input
              name="label"
              defaultValue={editing?.label ?? ""}
              placeholder="ej. Patio, Ventana"
              className="w-full px-3 py-2.5 bg-surface-2 border border-surface-border rounded-xl text-sm text-ink-primary
                placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/50 transition-colors"
            />
          </div>
          <Input
            label="Asientos"
            name="seats"
            type="number"
            min={1}
            max={20}
            defaultValue={editing?.seats ?? 4}
            required
          />
          <div className="flex justify-end gap-3 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => { setShowModal(false); setEditing(null); }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createMut.isPending || updateMut.isPending}
            >
              {editing ? "Guardar" : "Crear"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
