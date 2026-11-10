/** Cor a partir do canal RGB da variavel, com suporte a opacidade (bg-navy-900/40). */
const c = (name) => `rgb(var(--${name}-rgb) / <alpha-value>)`;

/**
 * Preset Tailwind da Olimach. As cores apontam para as CSS vars de tokens.css.
 * Aliases: canvas = --bg, line = --border, ink = --text.
 * @type {import('tailwindcss').Config}
 */
export default {
  theme: {
    extend: {
      colors: {
        navy: { 900: c("navy-900"), 700: c("navy-700") },
        brand: { 500: c("blue-500") },
        orange: { 500: c("orange-500"), 600: c("orange-600") },
        safety: c("safety-yellow"),
        canvas: c("bg"),
        surface: c("surface"),
        line: c("border"),
        ink: c("text"),
        muted: c("muted"),
        success: c("success"),
        warning: c("warning"),
        danger: c("danger"),
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
