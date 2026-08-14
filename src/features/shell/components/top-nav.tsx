"use client";

import { useTranslations } from "next-intl";
import { useLocaleContext } from "../../../i18n/locale-provider";
import { localeCatalog } from "../../../lib/story-catalog";
import { ThemeToggle } from "../../theme/components/theme-toggle";
import type { Locale } from "../../story-request/client/story-preferences-schema";

/**
 * Top navigation bar: brand mark + tagline, language toggle and theme toggle.
 *
 * Everything is anonymous and in-memory only — the language picker drives the
 * single-locale experience (ADR 0003 / T056) and nothing is persisted. All copy
 * comes from the next-intl catalogs (no hardcoded strings).
 */
export function TopNav() {
  const t = useTranslations("story.brand");
  const { locale, setLocale } = useLocaleContext();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-md p-md">
        <div className="flex items-center gap-sm">
          <OpenBookIcon aria-hidden="true" className="h-8 w-8 text-primary" />
          <div className="flex flex-col items-start gap-0">
            <p className="font-display text-title leading-title text-text">{t("name")}</p>
            <p className="text-caption text-text-subtle leading-caption">{t("tagline")}</p>
          </div>
        </div>
        <div className="flex items-center gap-sm">
          <label className="sr-only" htmlFor="top-nav-language">
            {t("languageLabel")}
          </label>
          <select
            id="top-nav-language"
            className="rounded-xl border border-border bg-card px-sm py-xs text-caption text-text focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label={locale === "pt-BR" ? t("portuguese") : t("english")}
            value={locale}
            onChange={(event) => setLocale(event.target.value as Locale)}
          >
            {localeCatalog.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.value === "pt-BR" ? t("portuguese") : t("english")}
              </option>
            ))}
          </select>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

/** Inline open-book brand mark (presentation only — no identifiers). */
function OpenBookIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}
