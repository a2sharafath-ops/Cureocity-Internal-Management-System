import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Ported from the Cureocity prototype theme
        teal: { DEFAULT: "#0d9488", dark: "#0f766e", light: "#ccfbf1" },
        sidebar: { DEFAULT: "#0c2b28", hover: "#123f3a" },
        ink: "#152523",
        muted: "#64748b",
        line: "#e3e9e7",
        surface: "#f4f7f6",
        amber: { DEFAULT: "#f59e0b", bg: "#fef3c7" },
        brandgreen: { DEFAULT: "#16a34a", bg: "#dcfce7" },
        brandred: { DEFAULT: "#dc2626", bg: "#fee2e2" },
        brandblue: { DEFAULT: "#2563eb", bg: "#dbeafe" },
        purple: { DEFAULT: "#7c3aed", bg: "#ede9fe" },
      },
      borderRadius: { xl: "14px" },
      boxShadow: {
        card: "0 1px 3px rgba(16,42,38,.07), 0 4px 14px rgba(16,42,38,.05)",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
