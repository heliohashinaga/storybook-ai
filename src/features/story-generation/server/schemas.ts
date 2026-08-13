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
 * Validated scene-count range — the single source of truth for the scene-count
 * extension point (3/4/5). The safety pipeline, the generation orchestrator,
 * and the response/ordinal schema all read from these constants, so a future
 * change edits exactly one place here. See `specs/002-generate-more-scenes/`.
 */
export const MIN_SCENES = 3;
export const MAX_SCENES = 5;
export const DEFAULT_SCENE_COUNT = MIN_SCENES;

/** Optional `sceneCount` on the inbound payload; absent defaults to 3 (v1 behavior). */
export const sceneCountSchema = z
  .number()
  .int()
  .min(MIN_SCENES)
  .max(MAX_SCENES)
  .default(DEFAULT_SCENE_COUNT);

/**
 * The only inbound payload the route accepts. Strict shape: no exact age, no
 * name, and no direct identifier can reach the server.
 */
export const generateRequestSchema = z
  .object({
    ageBand: ageBandSchema,
    locale: localeSchema,
    theme: themeSchema,
    sceneCount: sceneCountSchema.optional(),
  })
  .strict();

/**
 * Opaque, in-memory correlation token for the multi-agent pipeline (006). It is
 * a random hex nonce — never derived from or containing a direct identifier —
 * and is used solely to correlate stages within one anonymous request.
 */
export const generationTokenSchema = z
  .string()
  .regex(/^[0-9a-f]{16,}$/i, "generation token must be an opaque hex nonce");

export type GenerationToken = z.infer<typeof generationTokenSchema>;

/**
 * The anonymous in-memory working context threaded through the multi-agent
 * pipeline (006). Mirrors the inbound request but carries only the derived,
 * non-identifying fields plus a short-lived trace token. Reuses the shared
 * scene-count constants so a future range change edits exactly one place.
 */
export const jobContextSchema = z
  .object({
    ageBand: ageBandSchema,
    locale: localeSchema,
    theme: themeSchema,
    sceneCountRequested: sceneCountSchema,
    generationToken: generationTokenSchema,
  })
  .strict();

export type JobContext = z.infer<typeof jobContextSchema>;

/** One approved scene: localized plain text plus a session-only WebP data URI. */
export const sceneSchema = z
  .object({
    ordinal: z.number().int().min(1).max(MAX_SCENES),
    title: z.string().min(1).max(100),
    body: z.string().min(1).max(1600),
    illustrationDataUri: z.string().regex(/^data:image\/webp;base64,/),
    altText: z.string().min(1).max(300),
  })
  .strict();

export type GeneratedScene = z.infer<typeof sceneSchema>;

/**
 * A safety-approved story with 3–5 scenes. `safetyDecision` records whether the
 * original candidate was used or a single safe regeneration occurred; unsafe
 * intermediate content is never present.
 */
export const storyResponseSchema = z
  .object({
    locale: localeSchema,
    ageBand: ageBandSchema,
    theme: themeSchema,
    sceneCount: sceneCountSchema,
    safetyDecision: z.enum(["approved", "regenerated"]),
    title: z.string().min(1).max(140),
    scenes: z
      .array(sceneSchema)
      .min(MIN_SCENES)
      .max(MAX_SCENES)
      .refine(
        (s) => s.every((sc, i) => sc.ordinal === i + 1),
        "scene ordinals must be contiguous from 1"
      ),
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
