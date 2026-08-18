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
  const ariaValue = ariaValueAttrs(determinate, value, min, max);
  const containerClass = `flex flex-col gap-xs ${className ?? ""}`;
  const barClass = determinate
    ? "h-full rounded-full bg-primary transition-all duration-slow"
    : "h-full w-1/2 rounded-full bg-primary animate-pulse transition-all duration-slow";
  const barStyle = determinate ? { width: `${percent}%` } : undefined;

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-label={label}
      aria-busy={busy || undefined}
      className={containerClass}
      {...ariaValue}
      {...rest}
    >
      <div role="presentation" className="h-sm overflow-hidden rounded-full bg-secondary">
        <div className={barClass} style={barStyle} />
      </div>
      {children ? <div className="text-caption text-text-subtle">{children}</div> : null}
    </div>
  );
});

/** aria-valuemin/max/now for a determinate progress bar (all undefined when indeterminate). */
function ariaValueAttrs(
  determinate: boolean,
  value: number | undefined,
  min: number,
  max: number
): { "aria-valuemin"?: number; "aria-valuemax"?: number; "aria-valuenow"?: number } {
  return {
    "aria-valuemin": determinate ? min : undefined,
    "aria-valuemax": determinate ? max : undefined,
    "aria-valuenow": determinate ? value : undefined,
  };
}
