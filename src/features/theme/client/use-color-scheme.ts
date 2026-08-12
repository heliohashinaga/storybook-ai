"use client";

import { useCallback, useEffect, useState } from "react";

/** Color scheme modes: system (default, no override) or an explicit choice. */
export type ColorSchemeMode = "system" | "light" | "dark";

/**
 * Reads the user's system light/dark preference once, defaulting to light when
 * the API is unavailable (e.g. SSR first render / older browsers).
 */
function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export interface UseColorSchemeResult {
  /** Manual override: "system" means follow the OS; otherwise the explicit choice. */
  mode: ColorSchemeMode;
  /** The appearance currently applied to <html> ("light" or "dark"). */
  applied: "light" | "dark";
  /** Cycles the manual override between light and dark, overriding the system. */
  toggle: () => void;
  /** Resets to following the system preference (no manual override). */
  reset: () => void;
}

/**
 * Session-only color scheme for the app (spec 003, US5).
 *
 * Default is to follow the OS via `prefers-color-scheme` (no class on <html>).
 * `toggle()` adds a `.light` / `.dark` class that overrides the media query for
 * the current session only — nothing is persisted, so on reload the app returns
 * to following the system (anonymity preserved: no storage, no network).
 */
export function useColorScheme(): UseColorSchemeResult {
  const [mode, setMode] = useState<ColorSchemeMode>("system");

  const applied: "light" | "dark" =
    mode === "system" ? (systemPrefersDark() ? "dark" : "light") : mode;

  // Apply the override class to the document element, or clear it on "system".
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    if (mode !== "system") {
      root.classList.add(mode);
    }
  }, [mode]);

  const toggle = useCallback(() => {
    setMode((prev) => {
      const current: "light" | "dark" =
        prev === "system" ? (systemPrefersDark() ? "dark" : "light") : prev;
      return current === "dark" ? "light" : "dark";
    });
  }, []);

  const reset = useCallback(() => setMode("system"), []);

  return { mode, applied, toggle, reset };
}
