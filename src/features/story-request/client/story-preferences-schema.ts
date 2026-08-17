import { z } from "zod";

export const ageBandValues = ["2-4", "5-7", "8-9"] as const;
export const localeValues = ["pt-BR", "en"] as const;
export const themeValues = [
  "courage",
  "friendship",
  "kindness",
  "curiosity",
  "perseverance",
  "empathy",
] as const;

/** Client-side scene-count range (3, 4, 5); mirrors `schemas.ts` server bounds. */
export const MIN_SCENES = 3;
export const MAX_SCENES = 5;
export const DEFAULT_SCENE_COUNT = MIN_SCENES;
export const sceneCountSchema = z.number().int().min(MIN_SCENES).max(MAX_SCENES);

export type Locale = (typeof localeValues)[number];
export type Theme = (typeof themeValues)[number];

/**
 * Client-side validation for the anonymous StoryPreferences form. The exact
 * `age` is held in browser memory only and is NEVER sent to the network; it is
 * derived to an `AgeBand` by `deriveAgeBand`. The schema is strict so that any
 * direct child identifier (e.g. a `name` field) is rejected (anonymous by design).
 */
export const storyPreferencesSchema = z
  .object({
    age: z.number().int().min(2).max(9),
    locale: z.enum(localeValues),
    theme: z.enum(themeValues),
  })
  .strict();

export type StoryPreferences = z.infer<typeof storyPreferencesSchema>;
