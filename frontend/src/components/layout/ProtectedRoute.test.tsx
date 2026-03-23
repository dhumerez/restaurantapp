import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";

// Mock useAuth
const mockUseAuth = vi.fn();
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

function renderWithRouter(ui: React.ReactElement, initialEntries = ["/"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
  );
}

describe("ProtectedRoute", () => {
  it("shows loading spinner when loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("redirects to login when not authenticated", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("renders children when authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "1", name: "Admin", email: "a@b.com", role: "admin", restaurantId: "r1" },
      loading: false,
    });

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });

  it("renders children when user role matches", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "1", name: "Waiter", email: "w@b.com", role: "waiter", restaurantId: "r1" },
      loading: false,
    });

    renderWithRouter(
      <ProtectedRoute roles={["waiter", "admin"]}>
        <div>Waiter Content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText("Waiter Content")).toBeInTheDocument();
  });

  it("redirects when user role does not match", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "1", name: "Kitchen", email: "k@b.com", role: "kitchen", restaurantId: "r1" },
      loading: false,
    });

    renderWithRouter(
      <ProtectedRoute roles={["admin"]}>
        <div>Admin Only</div>
      </ProtectedRoute>
    );

    expect(screen.queryByText("Admin Only")).not.toBeInTheDocument();
  });
});
