"use client";

import { useTranslations } from "next-intl";
import { ThemeToggle } from "../../theme/components/theme-toggle";
import { LangToggle } from "./lang-toggle";

/**
 * Top bar (blossom-design §7.1): home brand mark + language + theme.
 *
 * Layout mirrors the reference — `max-w-5xl grid grid-cols-[1fr_auto]`.
 * - Left: a home button (primary, BookOpenText mark + display name + tagline);
 *   on a single-page anonymous app it scrolls to the top / focuses the story
 *   request rather than navigating to a different route.
 * - Right: segmented `LangToggle` (aria-pressed) + icon `ThemeToggle` (Sun/Moon).
 *
 * All state is in-memory only: language and theme pickers drive `useLocaleContext`
 * / `useColorScheme` and nothing is persisted. Strings come from next-intl.
 */
export function TopNav() {
  const t = useTranslations("story.brand");

  return (
    <header className="max-w-5xl grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-5">
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="flex items-center gap-3 text-left"
      >
        <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
          <BookOpenText className="size-6" aria-hidden="true" />
        </span>
        <span className="flex flex-col items-start">
          <span className="font-display text-lg leading-title font-bold">{t("name")}</span>
          <span className="text-xs leading-caption text-text-subtle">{t("tagline")}</span>
        </span>
      </button>
      <div className="flex items-center gap-3">
        <LangToggle />
        <ThemeToggle />
      </div>
    </header>
  );
}

/** Inline open-book brand mark (presentation only — no identifiers). */
function BookOpenText({ className }: { className?: string }) {
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
      <path d="M12 7v14" />
    </svg>
  );
}
