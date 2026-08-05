import {
  localeValues,
  themeValues,
} from "../features/story-request/client/story-preferences-schema";
import type { Locale, Theme } from "../features/story-request/client/story-preferences-schema";

/**
 * Primary/default locale for the application. Brazilian Portuguese is the
 * default UI language; English is supported as an alternative.
 */
export const defaultLocale: Locale = "pt-BR";

export interface LocaleEntry {
  value: Locale;
  label: string;
}

export interface ThemeEntry {
  value: Theme;
  label: string;
  description: string;
}

/**
 * Deterministic, typed catalog of supported locales. Derived from the
 * single source of truth (`localeValues`) so it can never drift from the
 * validated request schema.
 */
export const localeCatalog: readonly LocaleEntry[] = localeValues.map((value) => ({
  value,
  label: value === "pt-BR" ? "Português (Brasil)" : "English",
}));

/**
 * Deterministic, typed catalog of supported positive story themes. Derived
 * from the single source of truth (`themeValues`) so every theme in the
 * validated request schema has matching presentation metadata.
 */
export const themeCatalog: readonly ThemeEntry[] = themeValues.map((value) => {
  switch (value) {
    case "courage":
      return {
        value,
        label: "Courage",
        description: "Overcoming fear and doing the right thing.",
      };
    case "friendship":
      return {
        value,
        label: "Friendship",
        description: "Kindness, sharing, and being a good friend.",
      };
    case "kindness":
      return {
        value,
        label: "Kindness",
        description: "Caring for others and lending a hand.",
      };
  }
});

/**
 * Resolves an optional/unknown locale input to a supported `Locale`,
 * defaulting to `pt-BR` when the input is unspecified or unsupported.
 */
export function resolveLocale(input?: Locale | string): Locale {
  if (input === "pt-BR" || input === "en") return input;
  return defaultLocale;
}
