import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { trpc } from "../trpc.js";
import { authClient } from "../auth.js";

export const Route = createFileRoute("/restaurant-inactive")({
  component: RestaurantInactivePage,
});

function RestaurantInactivePage() {
  const navigate = useNavigate();
  const { data } = trpc.platform.publicContact.useQuery();

  const handleSignOut = async () => {
    await authClient.signOut();
    navigate({ to: "/login" });
  };

  const email = data?.contactEmail ?? "";
  const phone = data?.contactPhone ?? "";
  const hasContact = email.length > 0 || phone.length > 0;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <h1 className="text-2xl font-bold">Tu restaurante ha sido desactivado</h1>
        <p className="text-muted">
          Comunícate con el administrador de la plataforma para reactivar el acceso.
        </p>

        <div className="bg-surface border border-border rounded-xl p-6 space-y-2 text-sm">
          {hasContact ? (
            <>
              {email && (
                <div>
                  <span className="text-muted">Correo: </span>
                  <a href={`mailto:${email}`} className="text-accent hover:underline">{email}</a>
                </div>
              )}
              {phone && (
                <div>
                  <span className="text-muted">Teléfono: </span>
                  <span>{phone}</span>
                </div>
              )}
            </>
          ) : (
            <p className="text-muted">
              El administrador aún no ha configurado información de contacto.
            </p>
          )}
        </div>

        <button
          onClick={handleSignOut}
          className="border border-border rounded-lg px-4 py-2 text-sm hover:bg-surface"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
