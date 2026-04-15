import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { trpc } from "../../../trpc.js";

export const Route = createFileRoute("/_app/admin/tables")({
  component: AdminTablesPage,
});

function AdminTablesPage() {
  const utils = trpc.useUtils();
  const { data: tables = [] } = trpc.tables.list.useQuery();

  const create = trpc.tables.create.useMutation({
    onSuccess: () => utils.tables.list.invalidate(),
  });
  const remove = trpc.tables.delete.useMutation({
    onSuccess: () => utils.tables.list.invalidate(),
  });

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ number: "", seats: "" });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(
      { number: Number(form.number), seats: Number(form.seats) },
      {
        onSuccess: () => {
          setShowModal(false);
          setForm({ number: "", seats: "" });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tables</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-accent text-black font-semibold rounded-lg px-4 py-2 text-sm hover:bg-accent/80"
        >
          + Add Table
        </button>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {(tables as any[]).map((table: any) => (
          <div
            key={table.id}
            className="bg-surface border border-border rounded-xl p-4 relative"
          >
            <div className="font-bold text-lg">#{table.number}</div>
            <div className="text-xs text-muted mt-1">{table.seats} seats</div>
            <button
              onClick={() => remove.mutate({ id: table.id })}
              className="mt-2 border border-destructive text-destructive rounded-lg px-2 py-0.5 text-xs hover:bg-destructive/10"
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="font-semibold text-lg">Add Table</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-sm text-muted mb-1">Table Number</label>
                <input
                  required
                  type="number"
                  min="1"
                  value={form.number}
                  onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Seats</label>
                <input
                  required
                  type="number"
                  min="1"
                  value={form.seats}
                  onChange={(e) => setForm((f) => ({ ...f, seats: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border border-border rounded-lg px-4 py-2 text-sm hover:bg-background"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={create.isPending}
                  className="flex-1 bg-accent text-black font-semibold rounded-lg px-4 py-2 text-sm hover:bg-accent/80 disabled:opacity-50"
                >
                  {create.isPending ? "Adding…" : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
