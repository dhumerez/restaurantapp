import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { trpc } from "../trpc.js";

export const Route = createFileRoute("/demo")({
  component: DemoPage,
});

const roles = [
  { id: "admin", label: "Admin", description: "Manage menu, staff, inventory, reports", color: "bg-purple-600" },
  { id: "waiter", label: "Waiter", description: "Take orders, manage tables", color: "bg-blue-600" },
  { id: "kitchen", label: "Kitchen", description: "See incoming orders, update item status", color: "bg-orange-600" },
  { id: "cashier", label: "Cashier", description: "Process payments, apply discounts", color: "bg-green-600" },
] as const;

function DemoPage() {
  const navigate = useNavigate();
  const createDemo = trpc.auth.demo.create.useMutation({
    onSuccess(data) {
      navigate({ to: data.redirect });
    },
  });

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Try Demo Mode</h1>
          <p className="text-muted mt-2">Choose a role to explore the full experience</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => createDemo.mutate({ role: role.id })}
              disabled={createDemo.isPending}
              className={`${role.color} hover:opacity-90 rounded-xl p-6 text-left transition-all disabled:opacity-50`}
            >
              <div className="font-bold text-lg mb-1">{role.label}</div>
              <div className="text-sm opacity-80">{role.description}</div>
            </button>
          ))}
        </div>

        <p className="text-center text-sm text-muted">
          <a href="/login" className="hover:underline">← Back to login</a>
        </p>
      </div>
    </div>
  );
}
