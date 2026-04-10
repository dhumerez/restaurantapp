import { useState } from 'react';
import { HiEye, HiEyeOff } from 'react-icons/hi';
import type { AuthVariant } from '../types.js';

interface PasswordInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  variant: AuthVariant;
}

export function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete = 'current-password',
  variant,
}: PasswordInputProps) {
  const [show, setShow] = useState(false);

  const isDark = variant === 'dark';

  const inputClass = isDark
    ? 'w-full bg-surface-2 border border-surface-border rounded-lg px-3 py-2.5 text-sm text-ink-primary placeholder-ink-muted focus:outline-none focus:border-primary-500/50 pr-10'
    : 'w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10';

  const labelClass = isDark
    ? 'block text-xs font-medium text-ink-secondary mb-1'
    : 'block text-sm font-medium text-gray-700 mb-1';

  const btnClass = isDark
    ? 'absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-primary transition-colors'
    : 'absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors';

  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className={inputClass}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className={btnClass}
          tabIndex={-1}
          aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {show ? <HiEyeOff className="w-4 h-4" /> : <HiEye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
