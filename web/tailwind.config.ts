import type { Config } from "tailwindcss";

/**
 * Eventtz's design tokens, ported from `frontend/app/globals.css`.
 *
 * The baseline uses Tailwind v4's `@theme inline`; this project pins
 * Tailwind v3 (the version OSCE `platform-web` uses), so the same token
 * values are expressed as a v3 `theme.extend` instead. Values must match the
 * baseline's `:root` custom properties exactly.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: "var(--primary)",
        "primary-soft": "var(--primary-soft)",
        "primary-muted": "var(--primary-muted)",
        "primary-border": "var(--primary-border)",
        "accent-gold": "var(--accent-gold)",
        "accent-violet": "var(--accent-violet)",
        "page-bg": "var(--page-bg)",
        "auth-bg": "var(--auth-bg)",
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "ui-sans-serif", "sans-serif"],
        heading: ["var(--font-fraunces)", "ui-serif", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
