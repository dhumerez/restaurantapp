import { useState } from 'react';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import type { AuthPageProps } from './types';

export function AuthPage({
  appName,
  tagline,
  logo,
  registrationMode,
  onLogin,
  onRegister,
  defaultTab = 'login',
  variant = 'dark',
  demoCredentials,
  forgotPasswordHref,
}: AuthPageProps) {
  const [tab, setTab] = useState<'login' | 'register'>(defaultTab);
  const isDark = variant === 'dark';
  const showRegister = registrationMode !== 'disabled';

  const containerClass = isDark
    ? 'min-h-screen flex items-center justify-center bg-surface-0 px-4'
    : 'min-h-screen flex items-center justify-center bg-gray-50 px-4';

  const cardClass = isDark
    ? 'w-full max-w-sm bg-surface-1 border border-surface-border rounded-2xl p-7 shadow-xl'
    : 'w-full max-w-sm bg-white border border-gray-200 rounded-2xl p-7 shadow-lg';

  const tabActiveClass = isDark
    ? 'text-ink-primary border-b-2 border-primary-500 pb-2 text-sm font-semibold'
    : 'text-gray-900 border-b-2 border-blue-600 pb-2 text-sm font-semibold';

  const tabInactiveClass = isDark
    ? 'text-ink-muted pb-2 text-sm font-medium hover:text-ink-secondary transition-colors'
    : 'text-gray-400 pb-2 text-sm font-medium hover:text-gray-600 transition-colors';

  return (
    <div className={containerClass}>
      <div className={cardClass}>
        {/* Header */}
        <div className="text-center mb-6">
          {logo && <div className="mb-3 flex justify-center">{logo}</div>}
          <h1 className={`text-xl font-bold ${isDark ? 'text-ink-primary' : 'text-gray-900'}`}>
            {appName}
          </h1>
          {tagline && (
            <p className={`text-xs mt-1 ${isDark ? 'text-ink-muted' : 'text-gray-400'}`}>
              {tagline}
            </p>
          )}
        </div>

        {/* Tabs */}
        {showRegister && (
          <div className={`flex gap-6 mb-5 border-b ${isDark ? 'border-surface-border' : 'border-gray-200'}`} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'login'}
              onClick={() => setTab('login')}
              className={tab === 'login' ? tabActiveClass : tabInactiveClass}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'register'}
              onClick={() => setTab('register')}
              className={tab === 'register' ? tabActiveClass : tabInactiveClass}
            >
              Registrarse
            </button>
          </div>
        )}

        {/* Forms */}
        {tab === 'login' || !showRegister ? (
          <LoginForm
            onLogin={onLogin}
            onSwitchToRegister={showRegister ? () => setTab('register') : undefined}
            variant={variant}
            demoCredentials={demoCredentials}
            forgotPasswordHref={forgotPasswordHref}
          />
        ) : (
          <RegisterForm
            onRegister={onRegister ?? (async () => {})}
            onSwitchToLogin={() => setTab('login')}
            variant={variant}
          />
        )}
      </div>
    </div>
  );
}
