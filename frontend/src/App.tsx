import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import { ToastProvider } from "./components/ui/Toast";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { Sidebar } from "./components/layout/Sidebar";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Pages
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/admin/DashboardPage";
import { MenuManagementPage } from "./pages/admin/MenuManagementPage";
import { StaffManagementPage } from "./pages/admin/StaffManagementPage";
import { TablesPage } from "./pages/waiter/TablesPage";
import { OrderPage } from "./pages/waiter/OrderPage";
import { OrdersListPage } from "./pages/waiter/OrdersListPage";
import { KitchenDisplayPage } from "./pages/kitchen/KitchenDisplayPage";
import { TableManagementPage } from "./pages/admin/TableManagementPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppLayout() {
  const { user } = useAuth();

  // Kitchen display has its own full-screen layout
  if (user?.role === "kitchen") {
    return (
      <Routes>
        <Route
          path="/kitchen"
          element={
            <ProtectedRoute roles={["kitchen", "admin"]}>
              <KitchenDisplayPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/kitchen" replace />} />
      </Routes>
    );
  }

  return (
    <div className="flex min-h-screen bg-surface-0">
      {user && <Sidebar />}
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Admin routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={["admin"]}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/menu"
          element={
            <ProtectedRoute roles={["admin"]}>
              <MenuManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/staff"
          element={
            <ProtectedRoute roles={["admin"]}>
              <StaffManagementPage />
            </ProtectedRoute>
          }
        />

        {/* Admin table management */}
        <Route
          path="/admin/tables"
          element={
            <ProtectedRoute roles={["admin"]}>
              <TableManagementPage />
            </ProtectedRoute>
          }
        />

        {/* Waiter routes */}
        <Route
          path="/tables"
          element={
            <ProtectedRoute roles={["waiter", "admin"]}>
              <TablesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute roles={["waiter", "admin"]}>
              <OrdersListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/order/:id"
          element={
            <ProtectedRoute roles={["waiter", "admin"]}>
              <OrderPage />
            </ProtectedRoute>
          }
        />

        {/* Kitchen (also accessible from sidebar for admin) */}
        <Route
          path="/kitchen"
          element={
            <ProtectedRoute roles={["kitchen", "admin"]}>
              <KitchenDisplayPage />
            </ProtectedRoute>
          }
        />

        {/* Default redirect based on role */}
        <Route path="*" element={<RoleRedirect />} />
      </Routes>
    </div>
  );
}

function RoleRedirect() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const routes = {
    admin: "/admin",
    waiter: "/tables",
    kitchen: "/kitchen",
  };

  return <Navigate to={routes[user.role]} replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <SocketProvider>
              <ToastProvider>
                <AppLayout />
              </ToastProvider>
            </SocketProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
