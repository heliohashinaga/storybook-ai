import { routing } from "./routing";

import ptBR from "../features/story-request/locales/pt-BR.json";
import en from "../features/story-request/locales/en.json";
import ptBRNarration from "../features/story-read-aloud/locales/pt-BR.json";
import enNarration from "../features/story-read-aloud/locales/en.json";

export { routing };

/**
 * A single, stable default time zone shared by both locales (UTC). The app is
 * anonymous and intended to render identically for every visitor (SSR vs.
 * client must not mismatch), so we do not derive it from the user/browser;
 * this also removes next-intl's `timeZone` ENVIRONMENT_FALLBACK warning
 * (next-intl.dev/docs/configuration#time-zone).
 */
export const DEFAULT_TIME_ZONE = "UTC";

/** Recursively merges two message catalogs (later wins on scalar conflicts). */
function deepMerge<TBase, TExtra>(base: TBase, extra: TExtra): TBase & TExtra {
  if (
    base &&
    extra &&
    typeof base === "object" &&
    typeof extra === "object" &&
    !Array.isArray(base) &&
    !Array.isArray(extra)
  ) {
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const [key, value] of Object.entries(extra as Record<string, unknown>)) {
      const existing = (base as Record<string, unknown>)[key];
      out[key] =
        existing !== undefined && value && typeof existing === "object" && typeof value === "object"
          ? deepMerge(existing, value)
          : value;
    }
    return out as TBase & TExtra;
  }
  return extra as TBase & TExtra;
}

const ptBRFull = deepMerge(ptBR, ptBRNarration);
const enFull = deepMerge(en, enNarration);

/** Application-wide message catalog (base + per-feature narration keys). */
export type Messages = typeof ptBRFull;

const catalogs: Record<string, Messages> = {
  "pt-BR": ptBRFull,
  en: enFull,
};

/**
 * Returns the message catalog for a locale (or the `pt-BR` baseline when the
 * locale is absent or unsupported).
 */
export function getMessages(locale?: string): Messages {
  if (locale && catalogs[locale]) return catalogs[locale];
  return ptBRFull;
}
