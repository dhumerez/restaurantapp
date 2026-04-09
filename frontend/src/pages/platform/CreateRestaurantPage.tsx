import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { HiEye, HiEyeOff } from "react-icons/hi";
import { Header } from "../../components/layout/Header";
import * as superadminApi from "../../api/superadmin";

type FieldErrors = Partial<Record<string, string>>;

const SLUG_RE = /^[-a-z0-9]+$/;

function validate(form: typeof EMPTY_FORM): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.name.trim()) errors.name = "El nombre es obligatorio";
  if (!form.slug.trim()) {
    errors.slug = "El slug es obligatorio";
  } else if (!SLUG_RE.test(form.slug)) {
    errors.slug = "Solo letras minúsculas, números y guiones";
  }
  if (!form.currency.trim()) errors.currency = "La moneda es obligatoria";
  if (form.currency.length !== 3) errors.currency = "Debe tener exactamente 3 caracteres";
  if (!form.adminName.trim()) errors.adminName = "El nombre del administrador es obligatorio";
  if (!form.adminEmail.trim()) {
    errors.adminEmail = "El email es obligatorio";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.adminEmail)) {
    errors.adminEmail = "Email inválido";
  }
  if (!form.adminPassword) {
    errors.adminPassword = "La contraseña es obligatoria";
  } else if (form.adminPassword.length < 8) {
    errors.adminPassword = "Mínimo 8 caracteres";
  }
  return errors;
}

const EMPTY_FORM = {
  name: "",
  slug: "",
  address: "",
  currency: "USD",
  taxRate: "0.00",
  adminName: "",
  adminEmail: "",
  adminPassword: "",
};

export function CreateRestaurantPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: superadminApi.createRestaurant,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["platform-restaurants"] });
      queryClient.invalidateQueries({ queryKey: ["platform-stats"] });
      navigate(`/platform/restaurants/${data.restaurant.id}`);
    },
    onError: (err: any) => {
      const data = err.response?.data;
      if (data?.details?.length) {
        const mapped: FieldErrors = {};
        for (const d of data.details) {
          mapped[d.path] = d.message;
        }
        setFieldErrors(mapped);
        setGlobalError("Revisa los campos marcados");
      } else {
        setGlobalError(data?.error || "Error al crear el restaurante");
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const errors = validate(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setGlobalError("Revisa los campos marcados");
      return;
    }
    setFieldErrors({});
    setGlobalError("");
    mutation.mutate(form);
  };

  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
    setForm((f) => ({ ...f, name, slug }));
    if (submitted) {
      const errors = validate({ ...form, name, slug });
      setFieldErrors((fe) => ({ ...fe, name: errors.name, slug: errors.slug }));
    }
  };

  const handleField = (field: keyof typeof EMPTY_FORM, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (submitted) {
      const errors = validate({ ...form, [field]: value });
      setFieldErrors((fe) => ({ ...fe, [field]: errors[field] }));
    }
  };

  const inputClass = (field: string) =>
    `w-full px-3 py-2 bg-surface-0 border rounded-lg text-sm text-ink-primary focus:outline-none transition-colors ${
      fieldErrors[field]
        ? "border-red-500/60 focus:border-red-500"
        : "border-surface-border focus:border-primary-500/50"
    }`;

  const FieldError = ({ field }: { field: string }) =>
    fieldErrors[field] ? (
      <p className="mt-1 text-xs text-red-400">{fieldErrors[field]}</p>
    ) : null;

  return (
    <div className="flex-1 bg-surface-0">
      <Header title="Nuevo restaurante" />
      <div className="p-4 md:p-6 max-w-2xl">
        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {globalError && (
            <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
              {globalError}
            </div>
          )}

          {/* Restaurant info */}
          <div className="bg-surface-1 border border-surface-border rounded-2xl p-4 md:p-6">
            <h3 className="text-sm font-semibold text-ink-primary uppercase tracking-wider mb-4">
              Datos del restaurante
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5">Nombre</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className={inputClass("name")}
                  placeholder="Mi Restaurante"
                />
                <FieldError field="name" />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5">Slug (URL)</label>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-ink-muted">/</span>
                  <div className="flex-1">
                    <input
                      type="text"
                      value={form.slug}
                      onChange={(e) => handleField("slug", e.target.value)}
                      className={`${inputClass("slug")} font-mono`}
                      placeholder="mi-restaurante"
                    />
                    <FieldError field="slug" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5">
                  Dirección (opcional)
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => handleField("address", e.target.value)}
                  className={inputClass("address")}
                  placeholder="Av. Principal 123"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1.5">Moneda</label>
                  <input
                    type="text"
                    maxLength={3}
                    value={form.currency}
                    onChange={(e) => handleField("currency", e.target.value.toUpperCase())}
                    className={`${inputClass("currency")} font-mono`}
                    placeholder="USD"
                  />
                  <FieldError field="currency" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1.5">
                    Tasa de impuesto (%)
                  </label>
                  <input
                    type="text"
                    value={form.taxRate}
                    onChange={(e) => handleField("taxRate", e.target.value)}
                    className={`${inputClass("taxRate")} font-mono`}
                    placeholder="10.00"
                  />
                  <FieldError field="taxRate" />
                </div>
              </div>
            </div>
          </div>

          {/* Admin user */}
          <div className="bg-surface-1 border border-surface-border rounded-2xl p-4 md:p-6">
            <h3 className="text-sm font-semibold text-ink-primary uppercase tracking-wider mb-4">
              Administrador inicial
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5">Nombre</label>
                <input
                  type="text"
                  value={form.adminName}
                  onChange={(e) => handleField("adminName", e.target.value)}
                  className={inputClass("adminName")}
                  placeholder="Nombre del administrador"
                />
                <FieldError field="adminName" />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5">Email</label>
                <input
                  type="email"
                  value={form.adminEmail}
                  onChange={(e) => handleField("adminEmail", e.target.value)}
                  className={inputClass("adminEmail")}
                  placeholder="admin@restaurant.com"
                  autoComplete="off"
                />
                <FieldError field="adminEmail" />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5">Contraseña</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={form.adminPassword}
                    onChange={(e) => handleField("adminPassword", e.target.value)}
                    className={`${inputClass("adminPassword")} pr-10`}
                    placeholder="Mínimo 8 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-muted hover:text-ink-primary transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <HiEyeOff className="w-4 h-4" /> : <HiEye className="w-4 h-4" />}
                  </button>
                </div>
                <FieldError field="adminPassword" />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => navigate("/platform/restaurants")}
              className="px-4 py-2 text-sm font-medium text-ink-secondary hover:text-ink-primary border border-surface-border rounded-lg hover:bg-surface-2 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 bg-primary-500 text-surface-0 text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
            >
              {mutation.isPending ? "Creando..." : "Crear restaurante"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
