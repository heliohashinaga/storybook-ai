import { useTranslations } from "next-intl";

export interface SceneProgressProps {
  /** Current scene 1-based ordinal. */
  current: number;
  /** Total number of scenes (3–5, variable — spec 003, US3). */
  total: number;
  /** Accessible label rendered for the whole control. */
  label: string;
}

/**
 * Static, non-animated progress indicator for the reader (spec 003, US3).
 *
 * Shows one segment per scene, highlighting the current position. It is purely
 * presentational (no motion) so it honours `prefers-reduced-motion`, and it
 * exposes the position to assistive tech via `role="list"` + labelled items.
 * The total reflects the real scene count (3–5, variable).
 */
export function SceneProgress({ current, total, label }: SceneProgressProps) {
  const t = useTranslations("story.reader");

  return (
    <div role="list" aria-label={label} className="flex items-center gap-xs">
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const active = n === current;
        return (
          <span
            key={n}
            role="listitem"
            aria-current={active ? "step" : undefined}
            aria-label={t("sceneLabel", { ordinal: String(n) })}
            className={`h-2 w-2 rounded-full ${active ? "bg-primary" : "bg-secondary"}`}
          />
        );
      })}
    </div>
  );
}
