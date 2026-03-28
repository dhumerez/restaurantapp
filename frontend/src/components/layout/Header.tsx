import { useAuth } from "../../context/AuthContext";

export function Header({ title }: { title: string }) {
  const { user } = useAuth();

  return (
    <header className="h-12 md:h-14 bg-surface-1 border-b border-surface-border flex items-center justify-between px-4 md:px-6 shrink-0">
      <h2 className="text-base md:text-lg font-semibold text-ink-primary tracking-wide truncate">
        {title}
      </h2>
      {user && (
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <span className="text-xs text-ink-muted hidden sm:block">{user.name}</span>
          <div
            className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-primary-500/15 border border-primary-500/30
              text-primary-400 flex items-center justify-center text-xs font-semibold"
          >
            {user.name?.charAt(0)?.toUpperCase() ?? "?"}
          </div>
        </div>
      )}
    </header>
  );
}
