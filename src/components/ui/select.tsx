import { forwardRef, useId, type SelectHTMLAttributes, type ReactNode } from "react";

export type SelectSize = "sm" | "md" | "lg";

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  /** Accessible label (rendered with htmlFor). */
  label: string;
  /** Optional hint shown under the control (localized by caller). */
  hint?: string;
  size?: SelectSize;
  /** Error state: danger border, aria-invalid, and error text. */
  error?: string;
  children: ReactNode;
}

const sizes: Record<SelectSize, string> = {
  sm: "px-sm py-xs text-caption",
  md: "px-md py-sm text-body",
  lg: "px-lg py-md text-body",
};

const base =
  "w-full rounded-xl border bg-card text-text shadow-soft transition-colors duration-base " +
  "disabled:cursor-not-allowed disabled:bg-disabled disabled:text-text-subtle";

/**
 * Shared form select primitive. Forwarded ref, explicit label/hint/error API,
 * full keyboard navigation (native select), visible focus, aria-invalid on
 * error. No business logic — callers supply localized strings and options.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, size = "md", id, className, children, ...rest },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="flex flex-col gap-xs">
      <label htmlFor={inputId} className="text-body font-title">
        {label}
      </label>
      <select
        ref={ref}
        id={inputId}
        className={`${base} ${sizes[size]} ${error ? "border-danger" : "border-input"} ${className ?? ""}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        {...rest}
      >
        {children}
      </select>
      {hint ? (
        <span id={hintId} className="text-caption text-text-subtle">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} role="alert" className="text-caption text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
});
