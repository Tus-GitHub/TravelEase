import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Semantic tokens — resolved from CSS vars in globals.css, swap per theme.
        canvas: "rgb(var(--c-canvas) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        "surface-muted": "rgb(var(--c-surface-muted) / <alpha-value>)",
        "surface-hover": "rgb(var(--c-surface-hover) / <alpha-value>)",
        fg: "rgb(var(--c-fg) / <alpha-value>)",
        muted: "rgb(var(--c-muted) / <alpha-value>)",
        faint: "rgb(var(--c-faint) / <alpha-value>)",
        line: "rgb(var(--c-line) / <alpha-value>)",
        "line-subtle": "rgb(var(--c-line-subtle) / <alpha-value>)",
        primary: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
          950: "#172554",
        },
        accent: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
        },
        // Secondary "technology" accent — cyan/blue. Used sparingly (scroll
        // indicator head, glass edge-lights, data glyphs), never as a CTA colour.
        tech: {
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-poppins)", "var(--font-inter)", "sans-serif"],
      },
      fontSize: {
        // Editorial display scale — fluid, tight tracking, baked-in weight/leading.
        display: [
          "clamp(2.75rem, 6vw, 5rem)",
          { lineHeight: "0.95", letterSpacing: "-0.03em", fontWeight: "800" },
        ],
        "display-sm": [
          "clamp(2rem, 4.2vw, 3rem)",
          { lineHeight: "1.02", letterSpacing: "-0.025em", fontWeight: "800" },
        ],
        stat: [
          "clamp(1.75rem, 3vw, 2.75rem)",
          { lineHeight: "1", letterSpacing: "-0.02em", fontWeight: "700" },
        ],
      },
      letterSpacing: {
        eyebrow: "0.28em",
      },
      boxShadow: {
        card: "0 4px 24px rgba(15, 23, 42, 0.08)",
        "card-hover": "0 12px 40px rgba(15, 23, 42, 0.16)",
      },
      backgroundImage: {
        "hero-gradient":
          "linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #2563eb 100%)",
      },
      animation: {
        "fade-in": "fadeIn 0.6s ease-out both",
        "fade-up": "fadeUp 0.7s ease-out both",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
