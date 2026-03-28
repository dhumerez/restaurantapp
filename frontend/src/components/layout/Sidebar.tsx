import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  HiOutlineViewGrid,
  HiOutlineBookOpen,
  HiOutlineUsers,
  HiOutlineTable,
  HiOutlineClipboardList,
  HiOutlineLogout,
} from "react-icons/hi";
import type { IconType } from "react-icons";

interface NavItem {
  label: string;
  path: string;
  icon: IconType;
  roles: Array<"admin" | "waiter" | "kitchen">;
}

const navItems: NavItem[] = [
  { label: "Panel",          path: "/admin",        icon: HiOutlineViewGrid,     roles: ["admin"] },
  { label: "Menú",           path: "/admin/menu",   icon: HiOutlineBookOpen,     roles: ["admin"] },
  { label: "Personal",       path: "/admin/staff",  icon: HiOutlineUsers,        roles: ["admin"] },
  { label: "Mesas",          path: "/admin/tables", icon: HiOutlineTable,        roles: ["admin"] },
  { label: "Mesas",          path: "/tables",       icon: HiOutlineTable,        roles: ["waiter", "admin"] },
  { label: "Pedidos",        path: "/orders",       icon: HiOutlineClipboardList,roles: ["waiter", "admin"] },
  { label: "Cocina",         path: "/kitchen",      icon: HiOutlineClipboardList,roles: ["kitchen", "admin"] },
];

const roleColors: Record<string, string> = {
  admin:   "bg-primary-500/15 text-primary-400 border-primary-500/25",
  waiter:  "bg-blue-500/15 text-blue-400 border-blue-500/25",
  kitchen: "bg-orange-500/15 text-orange-400 border-orange-500/25",
};

const roleLabel: Record<string, string> = {
  admin:   "Admin",
  waiter:  "Mesero",
  kitchen: "Cocina",
};

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const visibleItems = navItems.filter((item) => item.roles.includes(user.role));

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <>
      {/* Desktop sidebar — hidden on mobile */}
      <aside className="hidden md:flex w-56 bg-surface-1 border-r border-surface-border min-h-screen flex-col shrink-0">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-surface-border">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-lg bg-primary-500 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-surface-0" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-.293.707L13 10.414V15a1 1 0 01-.553.894l-4 2A1 1 0 017 17v-6.586L3.293 6.707A1 1 0 013 6V4z"/>
              </svg>
            </div>
            <span className="text-lg font-semibold text-ink-primary tracking-wide">
              Restaurante
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary-500/15 border border-primary-500/30 flex items-center justify-center text-xs font-semibold text-primary-400">
              {user.name?.charAt(0)?.toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-ink-primary truncate">{user.name}</p>
            </div>
            <span className={`ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded border capitalize shrink-0 ${roleColors[user.role] ?? roleColors.admin}`}>
              {roleLabel[user.role] ?? user.role}
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2.5 py-3 space-y-0.5">
          {visibleItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/admin"}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 group
                ${isActive
                  ? "bg-primary-500/12 text-primary-400 border border-primary-500/20"
                  : "text-ink-secondary hover:text-ink-primary hover:bg-surface-2 border border-transparent"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? "text-primary-400" : "text-ink-muted group-hover:text-ink-secondary"}`} />
                  <span className="font-medium">{item.label}</span>
                  {isActive && (
                    <span className="ml-auto w-1 h-1 rounded-full bg-primary-400" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-2.5 py-3 border-t border-surface-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium
              text-ink-muted hover:text-red-400 hover:bg-red-500/8 w-full transition-all duration-150 group"
          >
            <HiOutlineLogout className="w-4 h-4 shrink-0 group-hover:text-red-400 transition-colors" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Mobile bottom tab bar — visible only on mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-1/95 backdrop-blur-lg border-t border-surface-border pb-safe">
        <div className="flex items-stretch justify-around px-1">
          {visibleItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/admin"}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 py-2 px-2 min-w-[3.5rem] min-h-[3rem] transition-colors
                ${isActive ? "text-primary-400" : "text-ink-muted"}`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={`w-5 h-5 ${isActive ? "text-primary-400" : "text-ink-muted"}`} />
                  <span className="text-[10px] font-medium leading-tight">{item.label}</span>
                  {isActive && (
                    <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary-400" />
                  )}
                </>
              )}
            </NavLink>
          ))}
          <button
            onClick={handleLogout}
            className="flex flex-col items-center justify-center gap-0.5 py-2 px-2 min-w-[3.5rem] min-h-[3rem] text-ink-muted"
          >
            <HiOutlineLogout className="w-5 h-5" />
            <span className="text-[10px] font-medium leading-tight">Salir</span>
          </button>
        </div>
      </nav>
    </>
  );
}
