import type { Config } from "tailwindcss";

/**
 * Semantic design tokens for the Storybook AI app.
 *
 * Token-only styling: component code must reference these semantic tokens and
 * never use raw hex/px/arbitrary values. This config is loaded from
 * `src/app/globals.css` via Tailwind's `@config` directive so it is the single
 * source of truth for the design system.
 *
 * Taxonomy (aligned with the design-system skill):
 *  - color: semantic (background/surface/text/subtle/accent/success/warning/
 *    danger/focus/disabled), never literal palette names.
 *  - typography: display/title/body/caption scale, weights, line-heights.
 *  - spacing: xs -> xl scale, consistent gaps.
 *  - radius / shadow / motion: tokenized.
 *
 * Note: `max-w-*` named values are not configured here. Tailwind v4 resolves
 * them as `--max-width` -> `--spacing` -> `--container`, and the legacy config
 * cannot reach the first namespace; see the `@theme` bridge in globals.css.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--color-background)",
        surface: "var(--color-surface)",
        text: {
          DEFAULT: "var(--color-text)",
          subtle: "var(--color-text-subtle)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          hover: "var(--color-accent-hover)",
        },
        focus: "var(--color-focus)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        danger: "var(--color-danger)",
        disabled: "var(--color-disabled)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      fontSize: {
        display: "var(--text-display)",
        title: "var(--text-title)",
        body: "var(--text-body)",
        caption: "var(--text-caption)",
      },
      fontWeight: {
        display: "var(--weight-display)",
        title: "var(--weight-title)",
        body: "var(--weight-body)",
        caption: "var(--weight-caption)",
      },
      lineHeight: {
        display: "var(--leading-display)",
        title: "var(--leading-title)",
        body: "var(--leading-body)",
        caption: "var(--leading-caption)",
      },
      spacing: {
        xs: "var(--space-xs)",
        sm: "var(--space-sm)",
        md: "var(--space-md)",
        lg: "var(--space-lg)",
        xl: "var(--space-xl)",
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        full: "var(--radius-full)",
      },
      boxShadow: {
        DEFAULT: "var(--shadow)",
        sm: "var(--shadow-sm)",
        lg: "var(--shadow-lg)",
      },
      transitionDuration: {
        fast: "var(--motion-fast)",
        base: "var(--motion-base)",
        slow: "var(--motion-slow)",
      },
    },
  },
};

export default config;
