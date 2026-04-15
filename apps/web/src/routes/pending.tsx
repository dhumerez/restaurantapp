import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/pending")({
  component: () => (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4 max-w-sm">
        <h1 className="text-xl font-semibold">Pending Approval</h1>
        <p className="text-muted text-sm">
          Your account is awaiting role assignment by an admin.
          You'll receive an email when you're approved.
        </p>
      </div>
    </div>
  ),
});
