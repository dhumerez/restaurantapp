import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/pending")({
  component: () => (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4 max-w-sm">
        <h1 className="text-xl font-semibold">Aprobación pendiente</h1>
        <p className="text-muted text-sm">
          Tu cuenta está esperando que un administrador te asigne un rol.
          Recibirás un correo cuando seas aprobado.
        </p>
      </div>
    </div>
  ),
});
