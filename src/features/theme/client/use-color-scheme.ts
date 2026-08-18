"use client";

import { useSyncExternalStore } from "react";

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

// --- Session-scoped module singleton (spec 003, US5) -------------------------
// The choice is shared across every ThemeToggle/seam and survives client-side
// (SPA) navigation — so the theme picked on the login screen carries into the
// demo and playground. It is deliberately NOT persisted: on a full reload the
// store resets to "system" and the app follows the OS again (anonymity: no
// storage, no network).
let currentMode: ColorSchemeMode = "system";
const listeners = new Set<() => void>();

function applyToRoot(mode: ColorSchemeMode): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  if (mode !== "system") root.classList.add(mode);
}

function commit(next: ColorSchemeMode): void {
  currentMode = next;
  applyToRoot(next);
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Client snapshot: the shared in-session mode. */
function getSnapshot(): ColorSchemeMode {
  return currentMode;
}

/** SSR first render always reports "system" (no media query on the server). */
function getServerSnapshot(): ColorSchemeMode {
  return "system";
}

/**
 * Session-only color scheme for the app (spec 003, US5).
 *
 * Default is to follow the OS via `prefers-color-scheme` (no class on <html>).
 * `toggle()` adds a `.light` / `.dark` class that overrides the media query for
 * the current session; on reload the app returns to following the system
 * (anonymity preserved: no storage, no network).
 */
export function useColorScheme(): UseColorSchemeResult {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const applied: "light" | "dark" =
    mode === "system" ? (systemPrefersDark() ? "dark" : "light") : mode;
  return {
    mode,
    applied,
    toggle: () => commit(applied === "dark" ? "light" : "dark"),
    reset: () => commit("system"),
  };
}
