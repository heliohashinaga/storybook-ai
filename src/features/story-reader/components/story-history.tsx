"use client";

import { useTranslations } from "next-intl";
import type { StoryEntry } from "../../story-request/client/story-session-context";
import { sortByNewest } from "./story-switcher-utils";

/**
 * Accessible story switcher sidebar (US3 / T049), blossom layout (spec 007).
 *
 * Renders the in-session stories as a labelled, thumbnail list (newest first).
 * Each row shows a miniature of the story's first scene, its title, and either
 * "Active" or the theme name. The active row carries `aria-pressed` and
 * `aria-current` for assistive tech. Buttons are native and individually
 * focusable (full keyboard navigation, visible focus via the design system).
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
  const tr = useTranslations("story.reader");
  const tc = useTranslations("story.catalog");

  if (storyEntries.length === 0) return null;

  return (
    <aside
      aria-label={t("label")}
      className="rounded-4xl border border-border bg-card p-md shadow-soft"
    >
      <h2 className="px-xs font-display text-title font-bold">{t("label")}</h2>
      <p className="mb-sm px-xs text-caption text-text-subtle">{tr("sessionOnly")}</p>
      <ul className="space-y-xs">
        {sortByNewest(storyEntries).map((entry) => {
          const isActive = entry.id === activeId;
          const thumbnail = entry.story.scenes[0];
          const label = `${t("storyItem")} — ${entry.story.title}`;
          const ariaLabel = isActive ? `${label} (${t("active")})` : label;
          return (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => onSelect(entry.id)}
                aria-pressed={isActive}
                aria-current={isActive ? "true" : undefined}
                aria-label={ariaLabel}
                className={`flex w-full items-center gap-sm rounded-2xl border-2 p-2 text-left transition-colors ${
                  isActive
                    ? "border-primary bg-secondary"
                    : "border-transparent hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                }`}
              >
                {thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element -- in-memory WebP data-URI thumbnail
                  <img
                    src={thumbnail.illustrationDataUri}
                    alt=""
                    loading="lazy"
                    className="size-12 shrink-0 rounded-xl object-cover"
                  />
                ) : null}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{entry.story.title}</span>
                  <span className="block truncate text-xs text-text-subtle">
                    {isActive ? t("active") : tc(`theme.${entry.story.theme}`)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
