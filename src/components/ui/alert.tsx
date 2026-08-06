import type { ReactNode } from "react";

export type AlertVariant = "info" | "success" | "warning" | "danger";

interface AlertProps {
  children: ReactNode;
  variant?: AlertVariant;
}

const styles: Record<AlertVariant, string> = {
  info: "border-focus/40 bg-surface text-text",
  success: "border-success/40 bg-surface text-text",
  warning: "border-warning/40 bg-surface text-text",
  danger: "border-danger/40 bg-surface text-danger",
};

const roles: Record<AlertVariant, "alert" | "status"> = {
  info: "status",
  success: "status",
  warning: "status",
  danger: "alert",
};

/**
 * Shared alert primitive. Danger renders role="alert" with assertive live
 * announcement; other variants render role="status" (polite). Callers supply
 * localized copy. No business logic.
 */
export function Alert({ children, variant = "info" }: AlertProps) {
  const role = roles[variant];
  return (
    <div
      role={role}
      aria-live={role === "alert" ? "assertive" : "polite"}
      className={`rounded-md border p-md text-body ${styles[variant]}`}
    >
      {children}
    </div>
  );
}
