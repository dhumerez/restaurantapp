import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { authClient } from "../auth.js";
import { trpc } from "../trpc.js";

export const Route = createFileRoute("/demo")({
  component: DemoPage,
});

const roles = [
  { id: "admin", label: "Administrador", description: "Gestiona menú, personal, inventario y reportes", color: "bg-purple-600" },
  { id: "waiter", label: "Mesero", description: "Toma pedidos y gestiona las mesas", color: "bg-blue-600" },
  { id: "kitchen", label: "Cocina", description: "Ve los pedidos entrantes y actualiza el estado", color: "bg-orange-600" },
  { id: "cashier", label: "Cajero", description: "Procesa pagos y aplica descuentos", color: "bg-green-600" },
] as const;

function DemoPage() {
  const navigate = useNavigate();
  const createDemo = trpc.auth.demo.create.useMutation({
    async onSuccess(data) {
      await authClient.getSession({ query: { disableCookieCache: true } });
      navigate({ to: data.redirect });
    },
  });

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Prueba el modo Demo</h1>
          <p className="text-muted mt-2">Elige un rol para explorar la experiencia completa</p>
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
          <Link to="/login" className="hover:underline">← Volver al inicio de sesión</Link>
        </p>
      </div>
    </div>
  );
}
