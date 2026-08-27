/** @type {import("tailwindcss").Config} */
export default {
  content: ["./src/**/*.{astro,html,js,ts,md}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#FF5A3D",
          hover: "#E6492F",
          soft: "#FFF0EB",
        },
        ivory: "#F7F5F2",
        "light-gray": "#E9ECEF",
        "slate-gray": "#CBD5E1",
        muted: "#667085",
        charcoal: "#1A1D23",
        "deep-navy": "#0D1117",
        ink: "var(--ink)",
        paper: {
          DEFAULT: "var(--paper)",
          dim: "var(--paper-70)",
          muted: "var(--paper-60)",
          faint: "var(--paper-40)",
          ghost: "var(--paper-25)",
        },
        surface: {
          1: "var(--paper-02)",
          2: "var(--paper-04)",
          3: "var(--paper-06)",
          hover: "var(--paper-12)",
        },
        line: "var(--border)",
        "line-dim": "var(--border-dim)",
        accent: "#FF5A3D",
        blue: "#2563eb",
        green: "#16a34a",
        red: "#FF5A3D",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: { DEFAULT: "6px", sm: "4px", lg: "10px" },
      maxWidth: { content: "72rem" },
    },
  },
  plugins: [],
};
