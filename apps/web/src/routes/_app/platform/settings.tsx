import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { trpc } from "../../../trpc.js";

export const Route = createFileRoute("/_app/platform/settings")({
  component: PlatformSettingsPage,
});

function PlatformSettingsPage() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.superadmin.settings.get.useQuery();
  const update = trpc.superadmin.settings.update.useMutation({
    onSuccess: () => utils.superadmin.settings.get.invalidate(),
  });

  const [saved, setSaved] = useState(false);

  if (isLoading || !data) {
    return <div className="max-w-md text-muted">Cargando…</div>;
  }

  return <SettingsForm initial={data} update={update} saved={saved} setSaved={setSaved} />;
}

function SettingsForm({
  initial,
  update,
  saved,
  setSaved,
}: {
  initial: { contactEmail: string; contactPhone: string };
  update: ReturnType<typeof trpc.superadmin.settings.update.useMutation>;
  saved: boolean;
  setSaved: (v: boolean) => void;
}) {
  const [form, setForm] = useState(initial);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    update.mutate(form, { onSuccess: () => setSaved(true) });
  };

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-2xl font-bold">Ajustes de la plataforma</h1>
      <p className="text-sm text-muted">
        Esta información se muestra a los restaurantes cuando su acceso ha sido desactivado.
      </p>

      <form onSubmit={onSubmit} className="bg-surface border border-border rounded-xl p-4 space-y-4">
        <div>
          <label className="block text-sm text-muted mb-1">Correo de contacto</label>
          <input
            type="email"
            value={form.contactEmail}
            onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
            placeholder="soporte@ejemplo.com"
          />
        </div>
        <div>
          <label className="block text-sm text-muted mb-1">Teléfono de contacto</label>
          <input
            value={form.contactPhone}
            onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
            placeholder="+1 555 123 4567"
          />
        </div>
        <div className="flex items-center justify-between pt-1">
          <button
            type="submit"
            disabled={update.isPending}
            className="bg-accent text-black font-semibold rounded-lg px-4 py-2 text-sm hover:bg-accent/80 disabled:opacity-50"
          >
            {update.isPending ? "Guardando…" : "Guardar"}
          </button>
          {saved && <span className="text-xs text-green-400">Guardado ✓</span>}
        </div>
      </form>
    </div>
  );
}
