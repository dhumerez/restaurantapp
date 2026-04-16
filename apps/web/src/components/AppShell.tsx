import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, ChefHat, ClipboardList, LayoutDashboard, LogOut, Menu, ShoppingBag, Users, UtensilsCrossed, Warehouse } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { authClient } from "../auth.js";
import { useNotificationStore } from "../store/notificationStore.js";

type NavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  roles: string[];
  // If provided, decides active state instead of default startsWith.
  isActive?: (path: string) => boolean;
};

const exact = (to: string) => (path: string) => path === to;

const navItems: NavItem[] = [
  { to: "/admin", label: "Panel", icon: <LayoutDashboard size={18} />, roles: ["admin"], isActive: exact("/admin") },
  { to: "/admin/menu", label: "Menú", icon: <UtensilsCrossed size={18} />, roles: ["admin"] },
  { to: "/admin/staff", label: "Personal", icon: <Users size={18} />, roles: ["admin"] },
  { to: "/admin/tables", label: "Mesas", icon: <ClipboardList size={18} />, roles: ["admin"] },
  { to: "/admin/inventory", label: "Inventario", icon: <Warehouse size={18} />, roles: ["admin"] },
  { to: "/admin/reports", label: "Reportes", icon: <ShoppingBag size={18} />, roles: ["admin"] },
  {
    to: "/waiter/tables",
    label: "Mesas",
    icon: <ClipboardList size={18} />,
    roles: ["waiter"],
    // Creating/editing an order from a table is still the Mesas flow.
    isActive: (path) =>
      path === "/waiter/tables" ||
      path === "/waiter/orders/new" ||
      /^\/waiter\/orders\/[^/]+$/.test(path),
  },
  {
    to: "/waiter/orders",
    label: "Pedidos",
    icon: <ShoppingBag size={18} />,
    roles: ["waiter"],
    isActive: exact("/waiter/orders"),
  },
  { to: "/cashier/tables", label: "Mesas", icon: <ClipboardList size={18} />, roles: ["cashier"] },
  { to: "/kitchen", label: "Cocina", icon: <ChefHat size={18} />, roles: ["kitchen"] },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session } = authClient.useSession();
  const role = (session?.user as any)?.role ?? "";
  const unread = useNotificationStore((s) => s.unreadCount);
  const notifications = useNotificationStore((s) => s.notifications);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const clearNotifications = useNotificationStore((s) => s.clear);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  useEffect(() => {
    if (!notifOpen) return;
    function onClick(e: MouseEvent) {
      if (!notifRef.current?.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [notifOpen]);

  function handleBellClick() {
    setNotifOpen((o) => {
      const next = !o;
      if (next && unread > 0) markAllRead();
      return next;
    });
  }

  function handleNotificationClick(url: string | undefined) {
    setNotifOpen(false);
    if (url) navigate({ to: url });
  }

  const roleNavItems = navItems.filter((n) => n.roles.includes(role));

  async function handleLogout() {
    await authClient.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className={`${mobileOpen ? "flex" : "hidden"} md:flex flex-col w-56 bg-surface border-r border-border shrink-0`}>
        <div className="p-4 border-b border-border">
          <span className="font-bold text-accent">Tu Restaurante</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {roleNavItems.map((item) => {
            const active = item.isActive
              ? item.isActive(currentPath)
              : currentPath.startsWith(item.to);
            return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-accent text-black font-medium"
                  : "text-muted hover:text-white hover:bg-border"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <div className="text-xs text-muted mb-2 px-3">{session?.user.email}</div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-muted hover:text-white hover:bg-border transition-colors"
          >
            <LogOut size={18} /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0">
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden">
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          <div className="relative" ref={notifRef}>
            <button onClick={handleBellClick} className="relative p-2 text-muted hover:text-white">
              <Bell size={20} />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-destructive text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-full mt-1 w-80 bg-surface border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <span className="font-semibold text-sm">Notificaciones</span>
                  {notifications.length > 0 && (
                    <button
                      onClick={() => clearNotifications()}
                      className="text-xs text-muted hover:text-white"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-muted text-sm">
                      Sin notificaciones
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => handleNotificationClick(n.url)}
                        className="w-full text-left px-4 py-3 border-b border-border last:border-b-0 hover:bg-border/50 transition-colors"
                      >
                        <div className="font-medium text-sm">{n.title}</div>
                        <div className="text-xs text-muted mt-0.5">{n.message}</div>
                        <div className="text-xs text-muted mt-1">
                          {new Date(n.createdAt).toLocaleTimeString()}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
