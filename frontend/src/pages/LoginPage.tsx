import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      navigate("/");
    } catch {
      setError("Correo o contraseña incorrectos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4 pt-safe">
      <div className="absolute inset-0 grain opacity-30 pointer-events-none" />

      <div className="w-full max-w-sm relative">
        {/* Brand */}
        <div className="text-center mb-8 md:mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-500/10 border border-primary-500/20 mb-4 md:mb-5 shadow-glow-amber">
            <svg className="w-7 h-7 text-primary-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-.293.707L13 10.414V15a1 1 0 01-.553.894l-4 2A1 1 0 017 17v-6.586L3.293 6.707A1 1 0 013 6V4z"/>
            </svg>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-semibold text-ink-primary tracking-wide mb-2">
            Restaurante
          </h1>
          <p className="text-sm text-ink-muted tracking-wide">Sistema de Punto de Venta</p>
        </div>

        {/* Card */}
        <div className="bg-surface-1 border border-surface-border rounded-2xl p-6 md:p-8 shadow-modal">
          <h2 className="font-display text-xl font-semibold text-ink-primary mb-5 md:mb-6 tracking-wide">
            Iniciar sesión
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2.5 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <Input
              label="Correo electrónico"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@demo.com"
              required
            />

            <Input
              label="Contraseña"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />

            <Button type="submit" disabled={loading} className="w-full mt-2" size="lg">
              {loading ? "Iniciando sesión..." : "Iniciar sesión"}
            </Button>
          </form>
        </div>

        {/* Demo credentials */}
        <div className="mt-4 md:mt-5 p-4 bg-surface-1/50 border border-surface-border rounded-xl">
          <p className="text-xs text-ink-muted font-medium uppercase tracking-widest mb-2">Cuentas demo</p>
          <div className="space-y-0.5">
            {[
              { rol: "Admin",  email: "admin@demo.com" },
              { rol: "Mesero", email: "waiter@demo.com" },
              { rol: "Cocina", email: "kitchen@demo.com" },
            ].map(({ rol, email: demoEmail }) => (
              <button
                key={rol}
                type="button"
                onClick={() => { setEmail(demoEmail); setPassword("password123"); }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-surface-2 transition-colors group min-h-[2.75rem]"
              >
                <span className="text-xs text-ink-secondary group-hover:text-ink-primary transition-colors">{demoEmail}</span>
                <span className="text-[10px] text-ink-muted uppercase tracking-wider">{rol}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-muted mt-2 text-center">password123</p>
        </div>
      </div>
    </div>
  );
}
