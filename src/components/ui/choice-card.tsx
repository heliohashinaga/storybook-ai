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
  "flex flex-col items-center justify-center gap-xs rounded-md border-2 bg-surface px-md py-lg " +
  "text-center transition-colors duration-base disabled:cursor-not-allowed " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus " +
  "disabled:opacity-50";

/**
 * Shared selectable card for choosing one option among a few (e.g. a story
 * theme). A single toggle via `aria-pressed`, visible focus (focus-visible
 * outline) and full keyboard activation. Colours use semantic tokens only;
 * callers supply localized label/description and manage single-selection.
 */
export const ChoiceCard = forwardRef<HTMLButtonElement, ChoiceCardProps>(function ChoiceCard(
  { label, description, selected = false, icon, onSelect, onClick, disabled, className, ...rest },
  ref
) {
  const stateClasses = selected ? "border-accent text-text" : "border-disabled text-text";
  return (
    <button
      ref={ref}
      type="button"
      className={`${base} ${stateClasses} hover:border-accent ${className ?? ""}`}
      aria-pressed={selected}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event);
        if (!disabled) onSelect?.();
      }}
      {...rest}
    >
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      <span className="text-body font-title">{label}</span>
      {description ? <span className="text-caption text-text-subtle">{description}</span> : null}
    </button>
  );
});
