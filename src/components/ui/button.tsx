import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Loading state: disables interaction, renders a spinner, aria-busy. */
  loading?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-xs rounded-md font-title transition-colors duration-base " +
  "disabled:pointer-events-none disabled:opacity-60 disabled:bg-disabled disabled:text-text-subtle";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover",
  secondary: "bg-surface text-text border border-disabled hover:border-text-subtle",
  danger: "bg-danger text-white hover:opacity-90",
  ghost: "bg-transparent text-text hover:bg-disabled",
};

const sizes: Record<ButtonSize, string> = {
  sm: "px-sm py-xs text-caption",
  md: "px-md py-sm text-body",
  lg: "px-lg py-md text-body",
};

const Spinner = () => (
  <span
    aria-hidden="true"
    className="inline-block size-sm animate-spin rounded-full border-2 border-current border-t-transparent"
  />
);

/**
 * Shared button primitive. Token-only styling, no business logic. Forwarded
 * ref, explicit variant/size/state API (disabled, loading, error). Loading is
 * announced with aria-busy and disabled so the control cannot be re-activated.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    variant = "primary",
    size = "md",
    loading = false,
    className,
    type = "button",
    disabled,
    ...rest
  },
  ref
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      type={type}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className ?? ""}`}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      aria-disabled={isDisabled || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
});
