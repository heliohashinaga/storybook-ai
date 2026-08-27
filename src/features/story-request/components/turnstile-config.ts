"use client";

/**
 * Shared client-side Turnstile config (feature 019).
 *
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is inlined at build time (Next public env),
 * but is read here via a **function** so unit tests can toggle it per-case
 * without reloading the module. When absent the widget is a no-op and the demo
 * behaves as today (feature off).
 */
export const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

export function isTurnstileSiteKeyConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}
