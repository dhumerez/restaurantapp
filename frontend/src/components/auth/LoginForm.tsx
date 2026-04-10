import { useState } from 'react';
import { PasswordInput } from './PasswordInput';
import type { AuthVariant, DemoCredential } from './types';

interface LoginFormProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onSwitchToRegister?: () => void;
  variant: AuthVariant;
  demoCredentials?: DemoCredential[];
  forgotPasswordHref?: string;
}

export function LoginForm({
  onLogin,
  onSwitchToRegister,
  variant,
  demoCredentials,
  forgotPasswordHref,
}: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isDark = variant === 'dark';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Correo o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = isDark
    ? 'w-full bg-surface-2 border border-surface-border rounded-lg px-3 py-2.5 text-sm text-ink-primary placeholder-ink-muted focus:outline-none focus:border-primary-500/50'
    : 'w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  const labelClass = isDark
    ? 'block text-xs font-medium text-ink-secondary mb-1'
    : 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className={`text-sm px-3 py-2 rounded-lg ${isDark ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-red-50 text-red-600 border border-red-200'}`}>
          {error}
        </div>
      )}

      <div>
        <label htmlFor="login-email" className={labelClass}>
          Correo electrónico
        </label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className={inputClass}
          placeholder="tu@email.com"
        />
      </div>

      <PasswordInput
        id="login-password"
        label="Contraseña"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
        variant={variant}
      />

      {forgotPasswordHref && (
        <div className="text-right">
          <a
            href={forgotPasswordHref}
            className={`text-xs ${isDark ? 'text-ink-muted hover:text-ink-secondary' : 'text-blue-600 hover:text-blue-700'}`}
          >
            ¿Olvidaste tu contraseña?
          </a>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
          isDark
            ? 'bg-primary-500 hover:bg-primary-600 text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
      </button>

      {onSwitchToRegister && (
        <p className={`text-center text-xs ${isDark ? 'text-ink-muted' : 'text-gray-500'}`}>
          ¿No tienes cuenta?{' '}
          <button
            type="button"
            onClick={onSwitchToRegister}
            className={isDark ? 'text-primary-400 hover:underline' : 'text-blue-600 hover:underline'}
          >
            Regístrate
          </button>
        </p>
      )}

      {demoCredentials && demoCredentials.length > 0 && (
        <div className={`border-t pt-3 ${isDark ? 'border-surface-border' : 'border-gray-200'}`}>
          <p className={`text-xs text-center mb-2 ${isDark ? 'text-ink-muted' : 'text-gray-400'}`}>
            Cuentas de demostración
          </p>
          <div className="flex gap-2 flex-wrap">
            {demoCredentials.map((cred) => (
              <button
                key={cred.email}
                type="button"
                onClick={() => { setEmail(cred.email); setPassword(cred.password); }}
                className={`flex-1 py-1.5 px-3 text-xs rounded border transition-colors ${
                  isDark
                    ? 'border-surface-border text-ink-muted hover:bg-surface-2 hover:text-ink-secondary'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {cred.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
