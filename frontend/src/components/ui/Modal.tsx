import { useEffect } from "react";
import type { ReactNode } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Dialog — full-width sheet on mobile, centered card on desktop */}
      <div
        className="relative bg-surface-1 border-t md:border border-surface-border
          rounded-t-2xl md:rounded-2xl
          shadow-modal w-full md:max-w-lg md:mx-auto
          max-h-[90vh] md:max-h-[85vh] overflow-y-auto
          animate-slide-up md:animate-fade-up"
        style={{ animationDuration: "0.25s" }}
      >
        {/* Drag handle on mobile */}
        <div className="md:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-surface-border" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-5 md:px-6 py-3 md:py-4 border-b border-surface-border sticky top-0 bg-surface-1 z-10">
          <h2 className="font-display text-lg md:text-xl font-semibold text-ink-primary tracking-wide">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 -mr-1 text-ink-muted hover:text-ink-primary hover:bg-surface-2
              rounded-lg transition-colors min-w-[2.75rem] min-h-[2.75rem] flex items-center justify-center"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Body */}
        <div className="px-5 md:px-6 py-4 md:py-5 pb-safe">{children}</div>
      </div>
    </div>
  );
}
