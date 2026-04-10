import { useNavigate } from "react-router-dom";
import { AuthPage } from "@shared/ui-auth";
import { useAuth } from "../context/AuthContext";

const DEMO_CREDENTIALS = [
  { label: "Admin",  email: "admin@demo.com",   password: "password123" },
  { label: "Mesero", email: "waiter@demo.com",  password: "password123" },
  { label: "Cocina", email: "kitchen@demo.com", password: "password123" },
];

export function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (email: string, password: string) => {
    await login(email, password);
    navigate("/");
  };

  const handleRegister = async (name: string, email: string, password: string) => {
    await register(name, email, password);
  };

  return (
    <AuthPage
      appName="Restaurante"
      tagline="Sistema de Punto de Venta"
      registrationMode="pending-approval"
      onLogin={handleLogin}
      onRegister={handleRegister}
      variant="dark"
      demoCredentials={DEMO_CREDENTIALS}
    />
  );
}
