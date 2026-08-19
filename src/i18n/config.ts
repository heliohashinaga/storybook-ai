import { routing } from "./routing";

import ptBR from "../features/story-request/locales/pt-BR.json";
import en from "../features/story-request/locales/en.json";
import ptBRNarration from "../features/story-read-aloud/locales/pt-BR.json";
import enNarration from "../features/story-read-aloud/locales/en.json";
import ptBRAuth from "../features/auth/locales/pt-BR.json";
import enAuth from "../features/auth/locales/en.json";

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
  if (isMergeableObject(base) && isMergeableObject(extra)) {
    return mergeRecords(
      base as Record<string, unknown>,
      extra as Record<string, unknown>
    ) as TBase & TExtra;
  }
  return extra as TBase & TExtra;
}

/** True when a value is a plain, non-array object that can be deep-merged. */
function isMergeableObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Merges `extra` onto a shallow copy of `base`, recursing for object leaves. */
function mergeRecords(
  base: Record<string, unknown>,
  extra: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    const existing = base[key];
    if (isMergeableObject(existing) && isMergeableObject(value)) {
      out[key] = mergeRecords(existing, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

const ptBRFull = deepMerge(deepMerge(ptBR, ptBRNarration), ptBRAuth);
const enFull = deepMerge(deepMerge(en, enNarration), enAuth);

/** Application-wide message catalog (base + per-feature narration keys). */
export type Messages = typeof ptBRFull;

const catalogs: Record<string, Messages> = {
  "pt-BR": ptBRFull,
  en: enFull,
};

/**
 * Returns the message catalog for a locale (or the `en` baseline when the
 * locale is absent or unsupported). `en` is the app default.
 */
export function getMessages(locale?: string): Messages {
  if (locale && catalogs[locale]) return catalogs[locale];
  return enFull;
}
