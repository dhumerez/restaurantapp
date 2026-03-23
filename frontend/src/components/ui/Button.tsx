import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
}

const variants = {
  primary:
    "bg-primary-500 text-surface-0 font-semibold hover:bg-primary-400 shadow-[0_0_16px_rgba(245,158,11,0.2)] hover:shadow-[0_0_20px_rgba(245,158,11,0.35)] active:bg-primary-600 disabled:bg-primary-900 disabled:text-primary-700 disabled:shadow-none",
  secondary:
    "bg-surface-2 text-ink-primary border border-surface-border hover:bg-surface-3 hover:border-surface-border-light disabled:opacity-40",
  danger:
    "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40 disabled:opacity-40",
  ghost:
    "text-ink-secondary hover:text-ink-primary hover:bg-surface-2 disabled:opacity-40",
  outline:
    "border border-primary-500/40 text-primary-400 hover:bg-primary-500/10 hover:border-primary-500 disabled:opacity-40",
};

const sizes = {
  sm: "px-3 py-1.5 text-xs h-7 rounded-md",
  md: "px-4 py-2 text-sm h-9 rounded-lg",
  lg: "px-5 py-2.5 text-sm h-11 rounded-lg",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 font-sans font-medium
        transition-all duration-150 active:scale-[0.97]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50
        disabled:cursor-not-allowed cursor-pointer select-none
        ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
