"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Button } from "../../../components/ui/button";
import { useColorScheme } from "../client/use-color-scheme";

/**
 * Manual session-only light/dark toggle (spec 003, US5). Shows the *effective*
 * appearance and switches it; nothing is persisted, so on reload the app follows
 * the system again. Uses a labelled button with `aria-pressed`.
 *
 * Hydration-safe: the effective theme depends on `matchMedia` (browser-only),
 * which returns a different value on the server than on the client. To avoid a
 * hydration mismatch, the toggle renders a stable, neutral "light" label until
 * the component has hydrated on the client, and only then shows the real
 * effective theme. `useSyncExternalStore` drives the client-vs-SSR drift
 * without a `setState`-in-effect, matching the project's token + a11y patterns.
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
  return (
    <Button type="button" variant="secondary" aria-pressed={isDark} onClick={toggle}>
      {isDark ? t("toLight") : t("toDark")}
    </Button>
  );
}

/** No-op subscribe — this store never emits, we only need its snapshot split. */
function subscribe(): () => void {
  return () => {};
}
