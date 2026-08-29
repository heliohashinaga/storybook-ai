import { enUS, ptBR } from "@clerk/localizations";

/** Local alias for Clerk's `LocalizationResource` (feature 020 / ADR 0013). */
export type ClerkLocalization = typeof enUS;

/** Base resource per app locale — `pt-BR` default, `en` fallback (ADR 0003). */
const BASE_BY_LOCALE: Readonly<Record<"pt-BR" | "en", ClerkLocalization>> = {
  "pt-BR": ptBR,
  en: enUS,
};

/**
 * Build the `ClerkProvider` `localization` for the active locale, applying the
 * app's customizations:
 *  - blank the default sign-in hero (`signIn.start.title/subtitle`) — the app
 *    renders its own brand/heading above the `<SignIn>` (ADR 0013 / feature 020);
 *  - surface the app's localized "access denied" copy as the TITLE of Clerk's
 *    restricted sign-up screen (`signUp.restrictedAccess`) — shown when a
 *    non-invited user tries to sign up in invite-only mode (feature 020).
 *
 * Every other key is spread through unchanged — notably the generic sign-in /
 * sign-up error copy (anti-enumeration) and the restricted subtítulo (kept as
 * Clerk's base). The spread is defensive: the builder never breaks if Clerk
 * removes/renames a key in a future version.
 */
export function buildClerkLocalization(
  locale: "pt-BR" | "en",
  accessDenied: string
): ClerkLocalization {
  const base = BASE_BY_LOCALE[locale];
  const next: ClerkLocalization = { ...base };

  if (next.signIn) {
    next.signIn = {
      ...next.signIn,
      start: { ...(next.signIn.start ?? {}), title: "", subtitle: "" },
    };
  }

  if (next.signUp) {
    next.signUp = {
      ...next.signUp,
      restrictedAccess: {
        ...(next.signUp.restrictedAccess ?? {}),
        title: accessDenied,
      },
    };
  }

  return next;
}
