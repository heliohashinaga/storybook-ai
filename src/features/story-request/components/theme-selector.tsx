"use client";

import { useTranslations } from "next-intl";
import { ChoiceCard } from "../../../components/ui/choice-card";
import { themeCatalog } from "../../../lib/story-catalog";
import type { Theme } from "../client/story-preferences-schema";

interface ThemeSelectorProps {
  /** Currently selected theme value. */
  value: Theme;
  onSelect: (theme: Theme) => void;
  disabled?: boolean;
}

/**
 * Reusable anonymous theme selector rendered as large emoji cards.
 *
 * Single source of truth for the six positive-value themes: it maps the typed
 * `themeCatalog` (schema-derived) into accessible ChoiceCard toggles with the
 * positive emoji on-brand. Used by the request form; candidate stories render
 * the same selector in different shells. Emoji are presentation-only.
 */
export function ThemeSelector({ value, onSelect, disabled = false }: ThemeSelectorProps) {
  const t = useTranslations("story.catalog");
  const formT = useTranslations("story.form");

  return (
    <fieldset disabled={disabled} aria-label={formT("theme.label")} className="flex flex-col">
      <legend className="font-display text-lg font-bold">{formT("theme.label")}</legend>
      <div className="mt-3 grid grid-cols-2 gap-md lg:grid-cols-3">
        {themeCatalog.map((entry) => (
          <ChoiceCard
            key={entry.value}
            icon={entry.emoji}
            label={t(`theme.${entry.value}`)}
            description={t(`themeDescription.${entry.value}`)}
            selected={value === entry.value}
            disabled={disabled}
            onSelect={() => onSelect(entry.value as Theme)}
          />
        ))}
      </div>
    </fieldset>
  );
}
