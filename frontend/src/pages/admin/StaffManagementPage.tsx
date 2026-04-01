import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Header } from "../../components/layout/Header";
import { getStaff, createStaff, updateStaff, deleteStaff } from "../../api/admin";
import type { StaffMember } from "../../api/admin";
import { useToast } from "../../components/ui/Toast";
import { Modal } from "../../components/ui/Modal";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

export function StaffManagementPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<StaffMember | null>(null);

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: getStaff,
  });

  const createMut = useMutation({
    mutationFn: createStaff,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast("Personal creado", "success");
      setShowModal(false);
    },
    onError: () => toast("Error al crear personal", "error"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Parameters<typeof updateStaff>[1]) =>
      updateStaff(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast("Personal actualizado", "success");
      setShowModal(false);
      setEditing(null);
    },
    onError: () => toast("Error al actualizar personal", "error"),
  });

  const deleteMut = useMutation({
    mutationFn: deleteStaff,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast("Personal desactivado", "success");
    },
    onError: () => toast("Error al desactivar personal", "error"),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = form.get("name") as string;
    const email = form.get("email") as string;
    const password = form.get("password") as string;
    const role = form.get("role") as "admin" | "waiter" | "kitchen";

    if (editing) {
      const updates: Record<string, unknown> = { name, email, role };
      if (password) updates.password = password;
      updateMut.mutate({ id: editing.id, ...updates });
    } else {
      createMut.mutate({ name, email, password, role });
    }
  };

  const roleStyles: Record<string, string> = {
    admin:   "bg-primary-500/10 text-primary-400 border-primary-500/20",
    waiter:  "bg-blue-500/10 text-blue-400 border-blue-500/20",
    kitchen: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    cashier: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  };

  const roleName = (role: string) =>
    role === "waiter" ? "Mesero" : role === "kitchen" ? "Cocina" : role === "cashier" ? "Cajero" : "Admin";

  return (
    <div className="flex-1 bg-surface-0">
      <Header title="Gestión de Personal" />
      <div className="p-4 md:p-6 max-w-5xl">
        <div className="flex justify-between items-center mb-4 md:mb-5">
          <p className="text-sm text-ink-muted">
            {staff.length} miembro{staff.length !== 1 ? "s" : ""} del personal
          </p>
          <Button size="sm" onClick={() => { setEditing(null); setShowModal(true); }}>
            + Agregar personal
          </Button>
        </div>

        {isLoading ? (
          <div className="bg-surface-1 border border-surface-border rounded-2xl p-16 text-center">
            <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto" />
          </div>
        ) : staff.length === 0 ? (
          <div className="bg-surface-1 border border-surface-border rounded-2xl p-16 text-center">
            <svg className="w-12 h-12 text-ink-muted mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm text-ink-muted">Sin miembros del personal</p>
          </div>
        ) : (
          <>
            {/* Mobile: Card view */}
            <div className="md:hidden space-y-2">
              {staff.map((member) => (
                <div key={member.id} className="bg-surface-1 border border-surface-border rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-sm font-semibold text-primary-400 shrink-0">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink-primary truncate">{member.name}</p>
                      <p className="text-xs text-ink-muted truncate">{member.email}</p>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full capitalize border shrink-0 ${roleStyles[member.role] ?? roleStyles.admin}`}>
                      {roleName(member.role)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${
                      member.isActive
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-surface-2 text-ink-muted border-surface-border"
                    }`}>
                      {member.isActive ? "Activo" : "Inactivo"}
                    </span>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => { setEditing(member); setShowModal(true); }}
                        className="text-xs font-medium text-ink-muted hover:text-primary-400 transition-colors min-h-[2.75rem] flex items-center"
                      >
                        Editar
                      </button>
                      {member.isActive ? (
                        <button
                          onClick={() => setDeactivateTarget(member)}
                          className="text-xs font-medium text-ink-muted hover:text-red-400 transition-colors min-h-[2.75rem] flex items-center"
                        >
                          Desactivar
                        </button>
                      ) : (
                        <button
                          onClick={() => updateMut.mutate({ id: member.id, isActive: true })}
                          className="text-xs font-medium text-ink-muted hover:text-emerald-400 transition-colors min-h-[2.75rem] flex items-center"
                        >
                          Activar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: Table view */}
            <div className="hidden md:block bg-surface-1 border border-surface-border rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-border">
                    <th className="text-left px-5 py-3 text-xs font-medium text-ink-muted uppercase tracking-widest">Nombre</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-ink-muted uppercase tracking-widest">Email</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-ink-muted uppercase tracking-widest">Rol</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-ink-muted uppercase tracking-widest">Estado</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-ink-muted uppercase tracking-widest">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((member) => (
                    <tr key={member.id} className="border-b border-surface-border last:border-0 hover:bg-surface-2/40 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-xs font-semibold text-primary-400 shrink-0">
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-ink-primary">{member.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-ink-secondary">{member.email}</td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full capitalize border ${roleStyles[member.role] ?? roleStyles.admin}`}>
                          {roleName(member.role)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${
                          member.isActive
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-surface-2 text-ink-muted border-surface-border"
                        }`}>
                          {member.isActive ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => { setEditing(member); setShowModal(true); }}
                            className="text-xs font-medium text-ink-muted hover:text-primary-400 transition-colors"
                          >
                            Editar
                          </button>
                          {member.isActive ? (
                            <button
                              onClick={() => setDeactivateTarget(member)}
                              className="text-xs font-medium text-ink-muted hover:text-red-400 transition-colors"
                            >
                              Desactivar
                            </button>
                          ) : (
                            <button
                              onClick={() => updateMut.mutate({ id: member.id, isActive: true })}
                              className="text-xs font-medium text-ink-muted hover:text-emerald-400 transition-colors"
                            >
                              Activar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        isOpen={deactivateTarget !== null}
        title="Desactivar personal"
        message={`¿Desactivar a ${deactivateTarget?.name}? No podrá iniciar sesión hasta que sea reactivado.`}
        confirmLabel="Desactivar"
        danger
        onConfirm={() => { deleteMut.mutate(deactivateTarget!.id); setDeactivateTarget(null); }}
        onCancel={() => setDeactivateTarget(null)}
      />

      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditing(null); }}
        title={editing ? "Editar personal" : "Agregar personal"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nombre"
            name="name"
            defaultValue={editing?.name ?? ""}
            required
          />
          <Input
            label="Email"
            type="email"
            name="email"
            defaultValue={editing?.email ?? ""}
            required
          />
          <div>
            <label className="block text-xs font-medium text-ink-secondary uppercase tracking-widest mb-1.5">
              Contraseña{editing && <span className="ml-1 text-ink-muted normal-case tracking-normal font-normal">(dejar en blanco para mantener)</span>}
            </label>
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              required={!editing}
              minLength={6}
              className="w-full px-3 py-3 md:py-2.5 bg-surface-2 border border-surface-border rounded-xl text-sm text-ink-primary
                placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/50 transition-colors min-h-[2.75rem]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-secondary uppercase tracking-widest mb-1.5">Rol</label>
            <select
              name="role"
              defaultValue={editing?.role ?? "waiter"}
              className="w-full px-3 py-3 md:py-2.5 bg-surface-2 border border-surface-border rounded-xl text-sm text-ink-primary
                focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/50 transition-colors min-h-[2.75rem]"
            >
              <option value="waiter">Mesero</option>
              <option value="kitchen">Cocina</option>
              <option value="cashier">Cajero</option>
              <option value="admin">Admin</option>
            </select>
          </div>
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
              {editing ? "Guardar cambios" : "Crear"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
