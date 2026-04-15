import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { trpc } from "../../../trpc.js";

export const Route = createFileRoute("/_app/admin/staff")({
  component: AdminStaffPage,
});

const ROLES = ["admin", "waiter", "kitchen", "cashier"] as const;

function AdminStaffPage() {
  const utils = trpc.useUtils();
  const { data: staff = [] } = trpc.staff.list.useQuery();

  const create = trpc.staff.create.useMutation({
    onSuccess: () => utils.staff.list.invalidate(),
  });
  const update = trpc.staff.update.useMutation({
    onSuccess: () => utils.staff.list.invalidate(),
  });

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "waiter" });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(form, {
      onSuccess: () => {
        setShowModal(false);
        setForm({ name: "", email: "", password: "", role: "waiter" });
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Staff</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-accent text-black font-semibold rounded-lg px-4 py-2 text-sm hover:bg-accent/80"
        >
          + Add Staff
        </button>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-muted font-medium px-4 py-3">Name</th>
              <th className="text-left text-muted font-medium px-4 py-3">Email</th>
              <th className="text-left text-muted font-medium px-4 py-3">Role</th>
              <th className="text-left text-muted font-medium px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(staff as any[]).map((member: any) => (
              <tr key={member.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{member.name}</td>
                <td className="px-4 py-3 text-muted">{member.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={member.role}
                    onChange={(e) => update.mutate({ id: member.id, role: e.target.value })}
                    className="bg-background border border-border rounded-lg px-2 py-1 text-sm"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => update.mutate({ id: member.id, isActive: !member.isActive })}
                    className={`text-xs px-2 py-0.5 rounded border capitalize ${
                      member.isActive
                        ? "bg-green-900/30 text-green-400 border-green-700"
                        : "bg-red-900/30 text-red-400 border-red-700"
                    }`}
                  >
                    {member.isActive ? "Active" : "Inactive"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="font-semibold text-lg">Add Staff Member</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-sm text-muted mb-1">Name</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Email</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Password</label>
                <input
                  required
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
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
