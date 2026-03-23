interface Props {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirmar",
  onConfirm,
  onCancel,
  danger = false,
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div
        className="relative bg-surface-1 border border-surface-border rounded-2xl shadow-modal w-full max-w-sm mx-auto animate-fade-up"
        style={{ animationDuration: "0.2s" }}
      >
        <div className="px-6 py-5">
          <h2 className="font-display text-xl font-semibold text-ink-primary mb-2 tracking-wide">
            {title}
          </h2>
          <p className="text-sm text-ink-secondary">{message}</p>
        </div>
        <div className="flex justify-end gap-3 px-6 pb-5">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-ink-muted hover:text-ink-primary hover:bg-surface-2 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
              danger
                ? "bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20"
                : "bg-primary-500/15 text-primary-400 hover:bg-primary-500/25 border border-primary-500/20"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
