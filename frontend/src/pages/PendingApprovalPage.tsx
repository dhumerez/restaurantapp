import { useAuth } from "../context/AuthContext";

export function PendingApprovalPage() {
  const { user, logout } = useAuth();

  const isPendingVerification = user?.status === "pending_verification";

  return (
    <div className="min-h-screen bg-[#08090e] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#0f1118] border border-white/10 rounded-2xl p-8 text-center">
        <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h1 className="text-white font-semibold text-lg mb-2">
          {isPendingVerification ? "Verifica tu correo" : "Cuenta pendiente de activación"}
        </h1>

        <p className="text-white/50 text-sm mb-6">
          {isPendingVerification
            ? `Hemos enviado un enlace de verificación a ${user?.email}. Por favor revisa tu bandeja de entrada.`
            : "Tu cuenta está verificada. Un administrador revisará tu solicitud y te asignará acceso próximamente."}
        </p>

        {!isPendingVerification && (
          <p className="text-white/30 text-xs mb-6">
            Si tienes dudas, contacta al administrador del sistema.
          </p>
        )}

        <button
          type="button"
          onClick={logout}
          className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-sm font-medium rounded-lg transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
