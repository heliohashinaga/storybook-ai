"use client";

import { useTranslations } from "next-intl";
import { useLocaleContext } from "../../../i18n/locale-provider";
import type { Locale } from "../../story-request/client/story-preferences-schema";

/**
 * Segmented language toggle (blossom-design §7.1).
 *
 * Renders the two supported locales as pill buttons; the active one is filled
 * primary. Session-only: toggling calls the in-memory `setLocale` (ADR 0003),
 * nothing is persisted. Both buttons use `aria-pressed` so screen readers see
 * exactly which language is active.
 */
export function LangToggle() {
  const t = useTranslations("story.brand");
  const { locale, setLocale } = useLocaleContext();

  const options: Array<{ value: Locale; label: string }> = [
    { value: "en", label: t("english") },
    { value: "pt-BR", label: t("portuguese") },
  ];

  return (
    <div
      role="group"
      aria-label={t("languageLabel")}
      className="flex items-center gap-xs rounded-2xl border border-border bg-card p-1"
    >
      {options.map((option) => {
        const active = locale === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => {
              if (!active) setLocale(option.value);
            }}
            className={`rounded-xl px-md py-xs text-caption font-title transition-colors duration-base ${
              active
                ? "bg-primary text-primary-foreground"
                : "bg-transparent text-text hover:bg-secondary"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
