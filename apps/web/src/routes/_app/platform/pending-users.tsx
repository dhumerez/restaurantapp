import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { trpc } from "../../../trpc.js";

export const Route = createFileRoute("/_app/platform/pending-users")({
  component: PlatformPendingUsersPage,
});

const ROLES = ["admin", "waiter", "kitchen", "cashier"] as const;

function PlatformPendingUsersPage() {
  const utils = trpc.useUtils();
  const { data: pendingUsers = [] } = trpc.superadmin.pendingUsers.list.useQuery();
  const { data: restaurants = [] } = trpc.superadmin.restaurants.list.useQuery();

  const approve = trpc.superadmin.pendingUsers.approve.useMutation({
    onSuccess: () => utils.superadmin.pendingUsers.list.invalidate(),
  });

  const [approveTarget, setApproveTarget] = useState<any>(null);
  const [approveForm, setApproveForm] = useState({ restaurantId: "", role: "waiter" });

  const handleApprove = (e: React.FormEvent) => {
    e.preventDefault();
    approve.mutate(
      {
        userId: approveTarget.id,
        restaurantId: approveForm.restaurantId,
        role: approveForm.role,
      },
      {
        onSuccess: () => {
          setApproveTarget(null);
          setApproveForm({ restaurantId: "", role: "waiter" });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Pending Users</h1>

      {(pendingUsers as any[]).length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-8 text-center text-muted">
          No pending users at the moment.
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-muted font-medium px-4 py-3">Name</th>
                <th className="text-left text-muted font-medium px-4 py-3">Email</th>
                <th className="text-left text-muted font-medium px-4 py-3">Registered</th>
                <th className="text-left text-muted font-medium px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {(pendingUsers as any[]).map((user: any) => (
                <tr key={user.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{user.name}</td>
                  <td className="px-4 py-3 text-muted">{user.email}</td>
                  <td className="px-4 py-3 text-muted text-xs">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setApproveTarget(user)}
                      className="bg-accent text-black font-semibold rounded-lg px-3 py-1.5 text-xs hover:bg-accent/80"
                    >
                      Approve
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {approveTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="font-semibold text-lg">Approve User</h2>
            <p className="text-sm text-muted">
              {approveTarget.name} — {approveTarget.email}
            </p>
            <form onSubmit={handleApprove} className="space-y-3">
              <div>
                <label className="block text-sm text-muted mb-1">Restaurant</label>
                <select
                  required
                  value={approveForm.restaurantId}
                  onChange={(e) =>
                    setApproveForm((f) => ({ ...f, restaurantId: e.target.value }))
                  }
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select restaurant…</option>
                  {(restaurants as any[]).map((r: any) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Role</label>
                <select
                  value={approveForm.role}
                  onChange={(e) => setApproveForm((f) => ({ ...f, role: e.target.value }))}
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
                  onClick={() => setApproveTarget(null)}
                  className="flex-1 border border-border rounded-lg px-4 py-2 text-sm hover:bg-background"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={approve.isPending}
                  className="flex-1 bg-accent text-black font-semibold rounded-lg px-4 py-2 text-sm hover:bg-accent/80 disabled:opacity-50"
                >
                  {approve.isPending ? "Approving…" : "Approve"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
