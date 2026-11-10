/**
 * Preset Tailwind da Olimach. As cores apontam para as CSS vars de tokens.css.
 * Aliases: canvas = --bg, line = --border, ink = --text.
 * @type {import('tailwindcss').Config}
 */
export default {
  theme: {
    extend: {
      colors: {
        navy: { 900: "var(--navy-900)", 700: "var(--navy-700)" },
        brand: { 500: "var(--blue-500)" },
        orange: { 500: "var(--orange-500)", 600: "var(--orange-600)" },
        safety: "var(--safety-yellow)",
        canvas: "var(--bg)",
        surface: "var(--surface)",
        line: "var(--border)",
        ink: "var(--text)",
        muted: "var(--muted)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
      },
      borderRadius: {
        card: "var(--radius-card)",
        "btn-admin": "var(--radius-btn-admin)",
        "btn-landing": "var(--radius-btn-landing)",
      },
      fontFamily: {
        heading: ["var(--font-heading)"],
        body: ["var(--font-body)"],
      },
    },
  },
};
