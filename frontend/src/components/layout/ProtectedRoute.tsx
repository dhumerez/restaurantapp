import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: Array<"admin" | "waiter" | "kitchen" | "superadmin">;
}

const defaultRoutes: Record<string, string> = {
  admin: "/admin",
  waiter: "/tables",
  kitchen: "/kitchen",
  superadmin: "/platform",
};

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={defaultRoutes[user.role] || "/login"} replace />;
  }

  return <>{children}</>;
}
