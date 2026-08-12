import { z } from "zod";

/**
 * Server-side Zod boundary for the generation contract
 * (`contracts/story-generation.openapi.yaml`). The server re-validates every
 * inbound request and every outbound story independently of the client, and
 * `additionalProperties: false` (`.strict()`) rejects any unknown or direct
 * identifier field (e.g. `name`) before a provider call or response.
 */

export const ageBandSchema = z.enum(["2-4", "5-7", "8-9"]);
export const localeSchema = z.enum(["pt-BR", "en"]);
export const themeSchema = z.enum(["courage", "friendship", "kindness"]);

export type AgeBand = z.infer<typeof ageBandSchema>;
export type Locale = z.infer<typeof localeSchema>;
export type Theme = z.infer<typeof themeSchema>;

/**
 * Validated MVP scene count — the single source of truth for the scene-count
 * extension point (3/4/5). The safety pipeline, the generation orchestrator,
 * and the response/ordinal schema all read from this one constant, so a
 * future variable-scene-count change edits exactly one value here.
 */
export const N_SCENES = 3;

/**
 * The only inbound payload the route accepts. Strict shape: no exact age, no
 * name, and no direct identifier can reach the server.
 */
export const generateRequestSchema = z
  .object({
    ageBand: ageBandSchema,
    locale: localeSchema,
    theme: themeSchema,
  })
  .strict();

/** One approved scene: localized plain text plus a session-only WebP data URI. */
export const sceneSchema = z
  .object({
    ordinal: z.number().int().min(1).max(N_SCENES),
    title: z.string().min(1).max(100),
    body: z.string().min(1).max(1600),
    illustrationDataUri: z.string().regex(/^data:image\/webp;base64,/),
    altText: z.string().min(1).max(300),
  })
  .strict();

export type GeneratedScene = z.infer<typeof sceneSchema>;

/**
 * A safety-approved three-scene story. `safetyDecision` records whether the
 * original candidate was used or a single safe regeneration occurred; unsafe
 * intermediate content is never present.
 */
export const storyResponseSchema = z
  .object({
    locale: localeSchema,
    ageBand: ageBandSchema,
    theme: themeSchema,
    safetyDecision: z.enum(["approved", "regenerated"]),
    title: z.string().min(1).max(140),
    scenes: z.array(sceneSchema).length(N_SCENES),
  })
  .strict();

export type GeneratedStory = z.infer<typeof storyResponseSchema>;

/** Wire-safe failure body: a stable code plus a localized key, never raw detail. */
export const safeErrorSchema = z
  .object({
    code: z.enum([
      "invalid_input",
      "unsupported_locale",
      "unsafe_unrecoverable",
      "rate_limited",
      "generation_unavailable",
      "generation_timeout",
    ]),
    messageKey: z.string().min(1),
    retryable: z.boolean(),
  })
  .strict();

export type SafeError = z.infer<typeof safeErrorSchema>;
