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

  return (
    <div className="flex flex-col gap-xs">
      <label htmlFor={inputId} className="text-body font-title">
        {label}
      </label>
      <select
        ref={ref}
        id={inputId}
        className={selectClass({ size, error, className })}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(inputId, hint, error)}
        {...rest}
      >
        {children}
      </select>
      {hint ? (
        <span id={`${inputId}-hint`} className="text-caption text-text-subtle">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${inputId}-error`} role="alert" className="text-caption text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
});

/** Concatenates the control base, size, error border, and caller classes. */
function selectClass({
  size,
  error,
  className,
}: {
  size: SelectSize;
  error?: string;
  className?: string;
}): string {
  const border = error ? "border-danger" : "border-input";
  return `${base} ${sizes[size]} ${border} ${className ?? ""}`;
}

/** Joins the hint/error element ids referenced by aria-describedby. */
function describedBy(inputId: string, hint?: string, error?: string): string | undefined {
  const ids: string[] = [];
  if (hint) ids.push(`${inputId}-hint`);
  if (error) ids.push(`${inputId}-error`);
  return ids.length > 0 ? ids.join(" ") : undefined;
}
