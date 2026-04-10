import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import * as authApi from "../api/auth";

type State = "loading" | "success" | "error";

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setState("error");
      setMessage("Token de verificación no encontrado.");
      return;
    }

    authApi
      .verifyEmail(token)
      .then((res) => {
        setMessage(res.message);
        setState("success");
      })
      .catch((err) => {
        setMessage(err.response?.data?.error || "El enlace es inválido o ha expirado.");
        setState("error");
      });
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-[#08090e] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#0f1118] border border-white/10 rounded-2xl p-8 text-center">
        {state === "loading" && (
          <>
            <div className="w-10 h-10 border-2 border-white/20 border-t-indigo-400 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white/60 text-sm">Verificando tu correo...</p>
          </>
        )}
        {state === "success" && (
          <>
            <div className="w-12 h-12 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-white font-semibold text-lg mb-2">¡Correo verificado!</h1>
            <p className="text-white/50 text-sm mb-6">{message}</p>
            <p className="text-white/40 text-xs mb-4">
              Un administrador revisará tu cuenta y te asignará un rol.
            </p>
            <Link
              to="/login"
              className="block w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Ir al inicio de sesión
            </Link>
          </>
        )}
        {state === "error" && (
          <>
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-white font-semibold text-lg mb-2">Error de verificación</h1>
            <p className="text-white/50 text-sm mb-6">{message}</p>
            <Link
              to="/login"
              className="block w-full py-2.5 bg-white/10 hover:bg-white/15 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Volver al inicio de sesión
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
