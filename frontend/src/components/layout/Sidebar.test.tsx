import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Sidebar } from "./Sidebar";

const mockUseAuth = vi.fn();
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

function renderSidebar() {
  return render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>
  );
}

describe("Sidebar", () => {
  it("returns null when no user", () => {
    mockUseAuth.mockReturnValue({ user: null, logout: vi.fn() });
    const { container } = renderSidebar();
    expect(container.innerHTML).toBe("");
  });

  it("shows admin navigation items for admin role", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "1", name: "Admin User", role: "admin", restaurantId: "r1" },
      logout: vi.fn(),
    });

    renderSidebar();

    // Spanish labels from updated Sidebar
    expect(screen.getByText("Panel")).toBeInTheDocument();
    expect(screen.getByText("Menú")).toBeInTheDocument();
    expect(screen.getByText("Personal")).toBeInTheDocument();
    expect(screen.getByText("Config. Mesas")).toBeInTheDocument();
    expect(screen.getByText("Mesas")).toBeInTheDocument();
    expect(screen.getByText("Pedidos")).toBeInTheDocument();
    expect(screen.getByText("Cocina")).toBeInTheDocument();
    expect(screen.getByText("Admin User")).toBeInTheDocument();
  });

  it("shows waiter navigation items for waiter role", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "2", name: "Waiter User", role: "waiter", restaurantId: "r1" },
      logout: vi.fn(),
    });

    renderSidebar();

    expect(screen.getByText("Mesas")).toBeInTheDocument();
    expect(screen.getByText("Pedidos")).toBeInTheDocument();
    // Should NOT show admin-only items
    expect(screen.queryByText("Panel")).not.toBeInTheDocument();
    expect(screen.queryByText("Menú")).not.toBeInTheDocument();
    expect(screen.queryByText("Personal")).not.toBeInTheDocument();
  });

  it("shows kitchen navigation items for kitchen role", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "3", name: "Kitchen User", role: "kitchen", restaurantId: "r1" },
      logout: vi.fn(),
    });

    renderSidebar();

    expect(screen.getByRole("link", { name: /cocina/i })).toBeInTheDocument();
    expect(screen.queryByText("Mesas")).not.toBeInTheDocument();
    expect(screen.queryByText("Pedidos")).not.toBeInTheDocument();
    expect(screen.queryByText("Panel")).not.toBeInTheDocument();
  });

  it("shows logout button", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "1", name: "Admin", role: "admin", restaurantId: "r1" },
      logout: vi.fn(),
    });

    renderSidebar();

    expect(screen.getByText("Cerrar sesión")).toBeInTheDocument();
  });
});
