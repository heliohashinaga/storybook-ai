"use client";

import { useTranslations } from "next-intl";
import { Button } from "../../../components/ui/button";
import type { StoryEntry } from "../../story-request/client/story-session-context";
import { sortByNewest } from "./story-switcher-utils";

/**
 * Accessible story switcher (US3 / T049).
 *
 * Renders the in-session stories as a labelled group of buttons, newest first.
 * The active story carries `aria-pressed` and `aria-current` for assistive
 * tech. Buttons are native and individually focusable (full keyboard
 * navigation, visible focus via the design system).
 */
export function StoryHistory({
  storyEntries,
  activeId,
  onSelect,
}: {
  storyEntries: StoryEntry[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("story.storySwitcher");

  if (storyEntries.length === 0) return null;

  return (
    <div role="group" aria-label={t("label")} className="flex flex-col gap-sm">
      <h2 className="font-title text-body font-semibold">{t("label")}</h2>
      <ul className="flex flex-col gap-sm">
        {sortByNewest(storyEntries).map((entry) => {
          const isActive = entry.id === activeId;
          const label = `${t("storyItem")} — ${entry.story.title}`;
          const ariaLabel = isActive ? `${label} (${t("active")})` : label;
          return (
            <li key={entry.id}>
              <Button
                variant={isActive ? "primary" : "secondary"}
                size="sm"
                className="w-full justify-start"
                aria-pressed={isActive}
                aria-current={isActive ? "true" : undefined}
                aria-label={ariaLabel}
                onClick={() => onSelect(entry.id)}
              >
                {label}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
