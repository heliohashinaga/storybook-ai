import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

interface ProgressProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Accessible label (localized by caller). */
  label: string;
  /** Current value. Omit (or omit value) for an indeterminate progress bar. */
  value?: number;
  min?: number;
  max?: number;
  /** Whether work is actively running (aria-busy). */
  busy?: boolean;
  children?: ReactNode;
}

/**
 * Shared progress primitive. role="progressbar" with aria-valuenow/min/max and
 * aria-busy while running. Deterministic width uses the computed percentage;
 * the bar fill is a computed value (not an ad-hoc token). No business logic.
 */
export const Progress = forwardRef<HTMLDivElement, ProgressProps>(function Progress(
  { label, value, min = 0, max = 100, busy = true, children, className, ...rest },
  ref
) {
  const determinate = typeof value === "number";
  const percent = determinate
    ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
    : undefined;

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-label={label}
      aria-valuemin={determinate ? min : undefined}
      aria-valuemax={determinate ? max : undefined}
      aria-valuenow={determinate ? value : undefined}
      aria-busy={busy || undefined}
      className={`flex flex-col gap-xs ${className ?? ""}`}
      {...rest}
    >
      <div role="presentation" className="h-sm overflow-hidden rounded-full bg-disabled">
        <div
          className={`h-full rounded-full bg-accent transition-[width] duration-base ${
            determinate ? "" : "w-1/2 animate-pulse"
          }`}
          style={determinate ? { width: `${percent}%` } : undefined}
        />
      </div>
      {children ? <div className="text-caption text-text-subtle">{children}</div> : null}
    </div>
  );
});
