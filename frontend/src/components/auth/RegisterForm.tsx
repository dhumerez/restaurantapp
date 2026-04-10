import { useState } from 'react';
import { PasswordInput } from './PasswordInput';
import type { AuthVariant } from './types';

interface RegisterFormProps {
  onRegister: (name: string, email: string, password: string) => Promise<void>;
  onSwitchToLogin: () => void;
  variant: AuthVariant;
}

export function RegisterForm({ onRegister, onSwitchToLogin, variant }: RegisterFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const isDark = variant === 'dark';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onRegister(name, email, password);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear cuenta');
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

  if (success) {
    return (
      <div className={`text-center space-y-3 py-4 ${isDark ? 'text-ink-primary' : 'text-gray-700'}`}>
        <div className={`text-3xl`}>✉️</div>
        <p className="font-semibold">¡Cuenta creada!</p>
        <p className={`text-sm ${isDark ? 'text-ink-muted' : 'text-gray-500'}`}>
          Revisa tu correo para verificar tu cuenta.
        </p>
        <button
          type="button"
          onClick={onSwitchToLogin}
          className={`text-sm ${isDark ? 'text-primary-400 hover:underline' : 'text-blue-600 hover:underline'}`}
        >
          Volver al inicio de sesión
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className={`text-sm px-3 py-2 rounded-lg ${isDark ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-red-50 text-red-600 border border-red-200'}`}>
          {error}
        </div>
      )}

      <div>
        <label htmlFor="register-name" className={labelClass}>
          Nombre
        </label>
        <input
          id="register-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
          className={inputClass}
          placeholder="Tu nombre"
        />
      </div>

      <div>
        <label htmlFor="register-email" className={labelClass}>
          Correo electrónico
        </label>
        <input
          id="register-email"
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
        id="register-password"
        label="Contraseña"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        variant={variant}
      />

      <button
        type="submit"
        disabled={loading}
        className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
          isDark
            ? 'bg-primary-500 hover:bg-primary-600 text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {loading ? 'Creando cuenta…' : 'Crear cuenta'}
      </button>

      <p className={`text-center text-xs ${isDark ? 'text-ink-muted' : 'text-gray-500'}`}>
        ¿Ya tienes cuenta?{' '}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className={isDark ? 'text-primary-400 hover:underline' : 'text-blue-600 hover:underline'}
        >
          Inicia sesión
        </button>
      </p>
    </form>
  );
}
