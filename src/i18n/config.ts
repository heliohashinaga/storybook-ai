import { routing } from "./routing";

import ptBR from "../features/story-request/locales/pt-BR.json";
import en from "../features/story-request/locales/en.json";

export { routing };

export type Messages = typeof ptBR;

/**
 * Locale → message catalog. The `en` locale uses the English catalog; every
 * other/unsupported locale falls back to the `pt-BR` baseline so the UI never
 * renders with missing strings (English support landed in US4).
 */
const catalogs: Record<string, Messages> = {
  "pt-BR": ptBR,
  en,
};

/**
 * Returns the message catalog for a locale (or the `pt-BR` baseline when the
 * locale is absent or unsupported).
 */
export function getMessages(locale?: string): Messages {
  if (locale && catalogs[locale]) return catalogs[locale];
  return ptBR;
}
