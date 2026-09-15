import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ─── Layered surfaces (clear brightness steps for depth/contrast) ───
        bg: "#070A11", // deepest — the page
        card: "#161E2E", // clearly lifts off the bg
        "card-hover": "#1F2A3D",
        surface: "#232E43", // distinct 3rd tier for inner elements/tiles

        // ─── Accent ───
        accent: "#22F0FF",
        "accent-dim": "rgba(34, 240, 255, 0.14)",
        "accent-mid": "rgba(34, 240, 255, 0.28)",

        // ─── Status / swipe affordances ───
        green: "#22E88A",
        "green-dim": "rgba(34, 232, 138, 0.15)",
        red: "#FF5C77",
        "red-dim": "rgba(255, 92, 119, 0.15)",
        amber: "#FFC24D",
        "amber-dim": "rgba(255, 194, 77, 0.15)",
        purple: "#B79CFF",
        "purple-dim": "rgba(183, 156, 255, 0.15)",

        // ─── Text ───
        muted: "#AEBAD0",
        "muted-dark": "#6B7A93",

        // ─── Borders ───
        border: "#2E3B52",
        "border-light": "#3C4C69",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "Segoe UI",
          "sans-serif",
        ],
        mono: [
          "SF Mono",
          "Fira Code",
          "JetBrains Mono",
          "Cascadia Code",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
