import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = "", id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-medium text-ink-secondary mb-1.5 uppercase tracking-wider"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full px-3.5 py-2.5 rounded-lg text-sm font-sans
          bg-surface-2 border text-ink-primary placeholder-ink-muted
          transition-all duration-150
          ${error ? "border-red-500/60 focus:border-red-500 focus:shadow-[0_0_0_2px_rgba(239,68,68,0.2)]"
                  : "border-surface-border focus:border-primary-500/60 focus:shadow-[0_0_0_2px_rgba(245,158,11,0.15)]"}
          focus:outline-none
          disabled:bg-surface-1 disabled:text-ink-muted disabled:cursor-not-allowed
          ${className}`}
        {...props}
      />
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
}
