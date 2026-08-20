import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export interface ChoiceCardProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "onChange" | "type"
> {
  /** Accessible label shown as the card title (localized by caller). */
  label: string;
  /** Optional subtitle describing the choice (localized by caller). */
  description?: string;
  /** Whether this card is currently selected (single-selection managed by caller). */
  selected?: boolean;
  /** Optional leading icon/visual element for the card. */
  icon?: ReactNode;
  /** Invoked when the card is activated. */
  onSelect?: () => void;
}

const base =
  "flex w-full flex-col items-center justify-center gap-sm rounded-3xl border-2 bg-card px-md py-md text-center " +
  "transition-all duration-base ease-[var(--motion-ease-standard)] active:border-primary disabled:cursor-not-allowed disabled:opacity-50 " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * Shared selectable card for choosing one option among a few (e.g. a story
 * theme). A single toggle via `aria-pressed`, visible focus (focus-visible
 * outline) and full keyboard activation. Uses the prototype's large-card
 * language (wide radius, soft idling shadow, lift when selected + hover).
 * Colours use semantic tokens only; callers supply localized label/
 * description/icon and manage single-selection.
 */
export const ChoiceCard = forwardRef<HTMLButtonElement, ChoiceCardProps>(function ChoiceCard(
  { label, description, selected = false, icon, onSelect, onClick, disabled, className, ...rest },
  ref
) {
  const stateClasses = selected
    ? "border-primary shadow-lift"
    : "border-border shadow-soft hover:border-primary/50 hover:-translate-y-0.5";
  return (
    <button
      ref={ref}
      type="button"
      className={`${base} ${stateClasses} ${className ?? ""}`}
      aria-pressed={selected}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event);
        if (!disabled) onSelect?.();
      }}
      {...rest}
    >
      {icon ? (
        <span aria-hidden="true" className="text-2xl sm:text-3xl">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 break-words text-title font-display font-bold leading-snug">
        {label}
      </span>
      {description ? (
        <span className="min-w-0 break-words text-caption leading-snug text-text-subtle">
          {description}
        </span>
      ) : null}
      <span
        aria-hidden="true"
        className={`h-1.5 w-10 rounded-full ${selected ? "bg-primary" : "bg-border"}`}
      />
    </button>
  );
});
