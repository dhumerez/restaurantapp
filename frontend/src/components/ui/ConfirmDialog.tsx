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
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div
        className="relative bg-surface-1 border-t md:border border-surface-border rounded-t-2xl md:rounded-2xl shadow-modal w-full md:max-w-sm md:mx-auto animate-slide-up md:animate-fade-up"
        style={{ animationDuration: "0.2s" }}
      >
        {/* Drag handle on mobile */}
        <div className="md:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-surface-border" />
        </div>
        <div className="px-5 md:px-6 py-4 md:py-5">
          <h2 className="font-display text-lg md:text-xl font-semibold text-ink-primary mb-2 tracking-wide">
            {title}
          </h2>
          <p className="text-sm text-ink-secondary">{message}</p>
        </div>
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 px-5 md:px-6 pb-5 pb-safe">
          <button
            onClick={onCancel}
            className="px-4 py-3 md:py-2 text-sm font-medium text-ink-muted hover:text-ink-primary hover:bg-surface-2 rounded-xl transition-colors min-h-[2.75rem]"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-3 md:py-2 text-sm font-medium rounded-xl transition-colors min-h-[2.75rem] ${
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
