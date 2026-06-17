import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#111827",
        surface: "#1F2937",
        "surface-low": "#0F172A",
        "surface-card": "#1E293B",
        "surface-card-2": "#273449",
        border: "#334155",
        "text-primary": "#F8FAFC",
        "text-secondary": "#94A3B8",
        accent: "#64748B",
        "accent-2": "#475569",
        success: "#22C55E",
        warning: "#F59E0B",
        danger: "#EF4444",
        // shadcn compat
        foreground: "#F8FAFC",
        card: { DEFAULT: "#1E293B", foreground: "#F8FAFC" },
        popover: { DEFAULT: "#1E293B", foreground: "#F8FAFC" },
        primary: { DEFAULT: "#F8FAFC", foreground: "#0F172A" },
        secondary: { DEFAULT: "#1F2937", foreground: "#94A3B8" },
        muted: { DEFAULT: "#1F2937", foreground: "#94A3B8" },
        destructive: { DEFAULT: "#EF4444", foreground: "#F8FAFC" },
        input: "#273449",
        ring: "#64748B",
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.25rem",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "JetBrains Mono", "monospace"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 2s linear infinite",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-in": "slide-in 0.3s ease-out",
      },
      backgroundImage: {
        shimmer:
          "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
