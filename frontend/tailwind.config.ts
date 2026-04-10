import type { Config } from "tailwindcss";

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../../../shared-ui-auth/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["Cormorant Garamond", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["DM Mono", "ui-monospace", "monospace"],
      },
      colors: {
        // Cool deep-slate backgrounds
        surface: {
          0: "#08090e",
          1: "#0f1118",
          2: "#151820",
          3: "#1c2030",
          border: "#232840",
          "border-light": "#2d3550",
        },
        // Indigo / violet — primary brand
        primary: {
          50:  "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
        // Cool text
        ink: {
          primary:   "#f0f4ff",
          secondary: "#9ca3af",
          muted:     "#64748b",
          inverse:   "#08090e",
        },
        // Status palette
        status: {
          draft:      { bg: "#1a1d28", text: "#64748b", border: "#2d3550" },
          placed:     { bg: "#0c1a2e", text: "#60a5fa", border: "#1e3a5f" },
          preparing:  { bg: "#1c1206", text: "#fbbf24", border: "#451a03" },
          ready:      { bg: "#052e1c", text: "#34d399", border: "#064e3b" },
          served:     { bg: "#1a1d28", text: "#64748b", border: "#2d3550" },
          cancelled:  { bg: "#1f0a0a", text: "#f87171", border: "#3b0c0c" },
        },
      },
      animation: {
        "fade-up":    "fade-up 0.4s ease-out forwards",
        "fade-in":    "fade-in 0.3s ease-out forwards",
        "slide-in":   "slide-in 0.3s ease-out",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        "slide-in": {
          from: { transform: "translateX(100%)", opacity: "0" },
          to:   { transform: "translateX(0)",    opacity: "1" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.6" },
        },
      },
      boxShadow: {
        "glow-amber": "0 0 20px rgba(99,102,241,0.2)",
        "glow-sm":    "0 2px 12px rgba(0,0,0,0.4)",
        "card":       "0 1px 3px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.3)",
        "modal":      "0 8px 40px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.5)",
      },
    },
  },
  plugins: [],
} satisfies Config;
