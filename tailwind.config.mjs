/** @type {import("tailwindcss").Config} */
export default {
  content: ["./src/**/*.{astro,html,js,ts,md}"],
  theme: {
    extend: {
      colors: {
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
        accent: "var(--red)",
        blue: "var(--blue)",
        green: "var(--green)",
        red: "var(--red)",
      },
      fontFamily: {
        sans: ["Instrument Sans", "system-ui", "sans-serif"],
        mono: ["Chivo Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: { DEFAULT: "6px", sm: "4px", lg: "10px" },
      maxWidth: { content: "72rem" },
    },
  },
  plugins: [],
};
