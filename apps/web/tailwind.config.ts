import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#08090e",
        surface: "#111318",
        border: "#1f2128",
        muted: "#6b7280",
        accent: "#f59e0b",
        "accent-hover": "#d97706",
        destructive: "#ef4444",
        success: "#22c55e",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
