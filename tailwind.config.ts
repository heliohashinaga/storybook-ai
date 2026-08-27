import type { Config } from "tailwindcss";

/**
 * Semantic design tokens for the Storybook AI app.
 *
 * Token-only styling: component code must reference these semantic tokens and
 * never use raw hex/px/arbitrary values. This config is loaded from
 * `src/app/globals.css` via Tailwind's `@config` directive so it is the single
 * source of truth for the design system.
 *
 * Taxonomy:
 *  - color: core semantic set (background/foreground/card/popover/primary/
 *    secondary/muted/accent/destructive/border/input/ring) plus legacy aliases
 *    (surface/text/text-subtle/focus/success/warning/danger/disabled) kept for
 *    migration in US6/T048 — never literal palette names.
 *  - typography: display (Baloo 2) + sans (Nunito) families, and the
 *    display/title/body/caption scale, weights, line-heights.
 *  - spacing: xs -> xl scale, consistent gaps.
 *  - radius / shadow / motion: tokenized. Radius derives from `--radius`.
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
        foreground: "var(--color-foreground)",
        card: {
          DEFAULT: "var(--color-card)",
          foreground: "var(--color-card-foreground)",
        },
        popover: {
          DEFAULT: "var(--color-popover)",
          foreground: "var(--color-popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--color-primary)",
          foreground: "var(--color-primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--color-secondary)",
          foreground: "var(--color-secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--color-muted)",
          foreground: "var(--color-muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          foreground: "var(--color-accent-foreground)",
          hover: "var(--color-accent-hover)",
        },
        destructive: {
          DEFAULT: "var(--color-destructive)",
          foreground: "var(--color-destructive-foreground)",
        },
        border: "var(--color-border)",
        input: "var(--color-input)",
        ring: "var(--color-ring)",

        /* Legacy aliases (kept for migration; see src/app/globals.css). */
        surface: "var(--color-surface)",
        text: {
          DEFAULT: "var(--color-text)",
          subtle: "var(--color-text-subtle)",
        },
        focus: "var(--color-focus)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        danger: "var(--color-danger)",
        disabled: "var(--color-disabled)",
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-rounded", "system-ui", "sans-serif"],
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
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
        "3xl": "var(--radius-3xl)",
        "4xl": "var(--radius-4xl)",
        full: "var(--radius-full)",
      },
      boxShadow: {
        DEFAULT: "var(--shadow)",
        soft: "var(--shadow-soft)",
        lift: "var(--shadow-lift)",
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
