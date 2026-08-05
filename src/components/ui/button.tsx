import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary";
}

/**
 * Minimal shared button primitive. Semantic tokens only (no ad-hoc values).
 * Full a11y + token styling coverage lands with the design-system work in
 * Phase 3; this stub exists to validate the Storybook/a11y test pipeline.
 */
export function Button({ children, variant = "primary", type = "button", ...rest }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors";
  const styles =
    variant === "primary"
      ? "bg-[color:var(--color-accent)] text-white hover:bg-[color:var(--color-accent-hover)]"
      : "bg-[color:var(--color-surface)] text-[color:var(--color-text)] border border-[color:var(--color-disabled)]";

  return (
    <button type={type} className={`${base} ${styles}`} {...rest}>
      {children}
    </button>
  );
}
