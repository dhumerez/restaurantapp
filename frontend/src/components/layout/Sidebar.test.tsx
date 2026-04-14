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

    // Each label appears twice (desktop sidebar + mobile bottom bar)
    expect(screen.getAllByText("Panel").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Menú").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Reportes").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mesas").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pedidos").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cocina").length).toBeGreaterThan(0);
    expect(screen.getByText("Admin User")).toBeInTheDocument();
  });

  it("shows waiter navigation items for waiter role", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "2", name: "Waiter User", role: "waiter", restaurantId: "r1" },
      logout: vi.fn(),
    });

    renderSidebar();

    expect(screen.getAllByText("Mesas").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pedidos").length).toBeGreaterThan(0);
    // Should NOT show admin-only items
    expect(screen.queryByText("Panel")).not.toBeInTheDocument();
    expect(screen.queryByText("Menú")).not.toBeInTheDocument();
    expect(screen.queryByText("Reportes")).not.toBeInTheDocument();
  });

  it("shows kitchen navigation items for kitchen role", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "3", name: "Kitchen User", role: "kitchen", restaurantId: "r1" },
      logout: vi.fn(),
    });

    renderSidebar();

    expect(screen.getAllByRole("link", { name: /cocina/i }).length).toBeGreaterThan(0);
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
