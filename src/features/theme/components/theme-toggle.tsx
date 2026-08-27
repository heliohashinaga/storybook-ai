"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { useColorScheme } from "../client/use-color-scheme";

/**
 * Manual session-only light/dark icon toggle (design system §7.1).
 *
 * A `size-11 rounded-2xl border bg-card` button showing a Sun/Moon icon for the
 * *effective* appearance, with `aria-pressed` for the toggle state. Nothing is
 * persisted — on reload the app follows the system again (spec 003, US5).
 *
 * Hydration-safe: the effective theme depends on `matchMedia` (browser-only),
 * which differs between server and client. To avoid a hydration mismatch the
 * icon stays neutral (moon shown as "turn on dark") until the component has
 * hydrated, then reflects the real effective theme via `useSyncExternalStore`'s
 * server/client snapshot split (drift handled without setState-in-effect).
 */
export function ThemeToggle() {
  const t = useTranslations("theme");
  const { applied, toggle } = useColorScheme();
  // 0 = server pre-hydration, 1 = client after hydration.
  const hydrated =
    useSyncExternalStore(
      subscribe,
      () => 1,
      () => 0
    ) === 1;

  const isDark = hydrated && applied === "dark";
  // The revealed label targets the action the toggle will perform.
  return (
    <button
      type="button"
      aria-label={isDark ? t("toLight") : t("toDark")}
      aria-pressed={isDark}
      onClick={toggle}
      className="flex size-11 items-center justify-center rounded-2xl border border-border bg-card text-text shadow-soft transition-all duration-base hover:shadow-lift hover:-translate-y-0.5"
    >
      {isDark ? <MoonIcon className="size-5" /> : <SunIcon className="size-5" />}
    </button>
  );
}

/** Sun icon (light mode active / the toggle turns the app light). */
function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

/** Moon icon (light toggled off, dark active — "turn on light"). */
function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

/** No-op subscribe — this store never emits, we only need its snapshot split. */
function subscribe(): () => void {
  return () => {};
}
