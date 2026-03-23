import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Header } from "./Header";

const mockUseAuth = vi.fn();
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("Header", () => {
  it("renders the title", () => {
    mockUseAuth.mockReturnValue({ user: null });
    render(<Header title="Test Page" />);
    expect(screen.getByText("Test Page")).toBeInTheDocument();
  });

  it("shows user avatar initial when authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "1", name: "John", role: "admin", restaurantId: "r1" },
    });
    render(<Header title="Dashboard" />);
    expect(screen.getByText("J")).toBeInTheDocument();
  });

  it("does not show avatar when not authenticated", () => {
    mockUseAuth.mockReturnValue({ user: null });
    render(<Header title="Dashboard" />);
    expect(screen.queryByText("J")).not.toBeInTheDocument();
  });
});
